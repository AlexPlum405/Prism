use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

use super::error::{PrismCommandError, PrismResult};
use super::workspace_index::{self, BuildWorkspaceIndexInput, WorkspaceIndexDto};
use super::workspace_index::{BacklinkDto, BuildRelationGraphInput, RelationGraphDto};

static NEXT_WORKSPACE_INDEX_JOB_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceIndexJobDto {
    pub id: String,
    pub root_path: String,
    pub status: String,
    pub stage: String,
    pub message: String,
    pub progress: f64,
    pub created_at: u64,
    pub updated_at: u64,
    pub completed_at: Option<u64>,
    pub index: Option<WorkspaceIndexDto>,
    pub error: Option<PrismCommandError>,
    pub cancel_requested: bool,
}

#[derive(Debug)]
struct WorkspaceIndexJobEntry {
    job: WorkspaceIndexJobDto,
    cancel_requested: Arc<AtomicBool>,
}

#[derive(Clone, Default)]
pub struct WorkspaceIndexJobStore {
    jobs: Arc<Mutex<HashMap<String, WorkspaceIndexJobEntry>>>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or(0)
}

fn next_job_id() -> String {
    let sequence = NEXT_WORKSPACE_INDEX_JOB_ID.fetch_add(1, Ordering::Relaxed);
    format!("workspace-index-{}-{sequence}", now_ms())
}

fn store_lock_error() -> PrismCommandError {
    PrismCommandError::new(
        "workspace_index_job_store_locked",
        "Workspace index job store is temporarily unavailable",
    )
    .with_stage("workspace_index_job")
}

fn missing_job_error(job_id: &str) -> PrismCommandError {
    PrismCommandError::new(
        "workspace_index_job_not_found",
        "Workspace index job does not exist",
    )
    .with_hint("Start a new workspace index job and try again.")
    .with_stage("workspace_index_job")
    .with_path(job_id)
}

fn cancel_running_jobs_for_root(
    jobs: &mut HashMap<String, WorkspaceIndexJobEntry>,
    root_path: &str,
    now: u64,
) {
    for entry in jobs.values_mut() {
        if entry.job.root_path != root_path || entry.job.status != "running" {
            continue;
        }
        entry.cancel_requested.store(true, Ordering::Relaxed);
        entry.job.status = "cancelled".to_string();
        entry.job.stage = "cancel_requested".to_string();
        entry.job.message = "Workspace index job was superseded".to_string();
        entry.job.updated_at = now;
        entry.job.completed_at = Some(now);
        entry.job.cancel_requested = true;
    }
}

fn update_running_stage(store: &WorkspaceIndexJobStore, job_id: &str) -> PrismResult<()> {
    let mut jobs = store.jobs.lock().map_err(|_| store_lock_error())?;
    let Some(entry) = jobs.get_mut(job_id) else {
        return Ok(());
    };
    if entry.job.status != "running" || entry.cancel_requested.load(Ordering::Relaxed) {
        return Ok(());
    }
    entry.job.stage = "build".to_string();
    entry.job.message = "Building workspace index".to_string();
    entry.job.progress = 0.2;
    entry.job.updated_at = now_ms();
    Ok(())
}

fn finish_workspace_index_job(
    store: &WorkspaceIndexJobStore,
    job_id: &str,
    cancel_requested: Arc<AtomicBool>,
    result: PrismResult<WorkspaceIndexDto>,
) -> PrismResult<()> {
    let mut jobs = store.jobs.lock().map_err(|_| store_lock_error())?;
    let Some(entry) = jobs.get_mut(job_id) else {
        return Ok(());
    };

    let now = now_ms();
    if cancel_requested.load(Ordering::Relaxed) || entry.job.cancel_requested {
        entry.job.status = "cancelled".to_string();
        entry.job.stage = "cancelled".to_string();
        entry.job.message = "Workspace index job was cancelled".to_string();
        entry.job.progress = 1.0;
        entry.job.updated_at = now;
        entry.job.completed_at = Some(now);
        entry.job.index = None;
        entry.job.cancel_requested = true;
        return Ok(());
    }

    match result {
        Ok(index) => {
            entry.job.status = "completed".to_string();
            entry.job.stage = "completed".to_string();
            entry.job.message = "Workspace index is ready".to_string();
            entry.job.progress = 1.0;
            entry.job.updated_at = now;
            entry.job.completed_at = Some(now);
            entry.job.index = Some(index);
            entry.job.error = None;
        }
        Err(error) => {
            entry.job.status = "failed".to_string();
            entry.job.stage = error.stage.clone().unwrap_or_else(|| "failed".to_string());
            entry.job.message = error.message.clone();
            entry.job.progress = 1.0;
            entry.job.updated_at = now;
            entry.job.completed_at = Some(now);
            entry.job.index = None;
            entry.job.error = Some(error);
        }
    }

    Ok(())
}

pub fn start_workspace_index_job(
    store: &WorkspaceIndexJobStore,
    input: BuildWorkspaceIndexInput,
) -> PrismResult<WorkspaceIndexJobDto> {
    let now = now_ms();
    let cancel_requested = Arc::new(AtomicBool::new(false));
    let job = WorkspaceIndexJobDto {
        id: next_job_id(),
        root_path: input.root_path.clone(),
        status: "running".to_string(),
        stage: "queued".to_string(),
        message: "Workspace index job queued".to_string(),
        progress: 0.0,
        created_at: now,
        updated_at: now,
        completed_at: None,
        index: None,
        error: None,
        cancel_requested: false,
    };

    {
        let mut jobs = store.jobs.lock().map_err(|_| store_lock_error())?;
        cancel_running_jobs_for_root(&mut jobs, &input.root_path, now);
        jobs.insert(
            job.id.clone(),
            WorkspaceIndexJobEntry {
                job: job.clone(),
                cancel_requested: cancel_requested.clone(),
            },
        );
    }

    let thread_store = store.clone();
    let thread_job_id = job.id.clone();
    thread::spawn(move || {
        let _ = update_running_stage(&thread_store, &thread_job_id);
        let result = workspace_index::build_workspace_index(input);
        let _ = finish_workspace_index_job(&thread_store, &thread_job_id, cancel_requested, result);
    });

    Ok(job)
}

pub fn get_workspace_index_job(
    store: &WorkspaceIndexJobStore,
    job_id: String,
) -> PrismResult<WorkspaceIndexJobDto> {
    let jobs = store.jobs.lock().map_err(|_| store_lock_error())?;
    jobs.get(&job_id)
        .map(|entry| entry.job.clone())
        .ok_or_else(|| missing_job_error(&job_id))
}

pub fn cancel_workspace_index_job(
    store: &WorkspaceIndexJobStore,
    job_id: String,
) -> PrismResult<WorkspaceIndexJobDto> {
    let mut jobs = store.jobs.lock().map_err(|_| store_lock_error())?;
    let entry = jobs
        .get_mut(&job_id)
        .ok_or_else(|| missing_job_error(&job_id))?;

    if entry.job.status == "completed" || entry.job.status == "failed" {
        return Ok(entry.job.clone());
    }

    let now = now_ms();
    entry.cancel_requested.store(true, Ordering::Relaxed);
    entry.job.status = "cancelled".to_string();
    entry.job.stage = "cancel_requested".to_string();
    entry.job.message = "Workspace index cancellation requested".to_string();
    entry.job.progress = 1.0;
    entry.job.updated_at = now;
    entry.job.completed_at = Some(now);
    entry.job.cancel_requested = true;
    Ok(entry.job.clone())
}

fn completed_workspace_index_for_job(
    store: &WorkspaceIndexJobStore,
    job_id: &str,
    stage: &str,
) -> PrismResult<WorkspaceIndexDto> {
    let jobs = store.jobs.lock().map_err(|_| store_lock_error())?;
    let job = jobs
        .get(job_id)
        .ok_or_else(|| missing_job_error(job_id))?
        .job
        .clone();
    if job.status != "completed" {
        return Err(PrismCommandError::new(
            "workspace_index_job_not_ready",
            "Workspace index job is not completed",
        )
        .with_hint("Wait for the workspace index job to complete and try again.")
        .with_stage(stage)
        .with_path(job_id));
    }
    job.index.ok_or_else(|| {
        PrismCommandError::new(
            "workspace_index_job_missing_index",
            "Workspace index job completed without an index",
        )
        .with_stage(stage)
        .with_path(job_id)
    })
}

#[derive(Debug, serde::Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct QueryWorkspaceBacklinksInput {
    pub job_id: String,
    pub path: String,
}

#[derive(Debug, serde::Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct QueryWorkspaceRelationGraphInput {
    pub job_id: String,
    pub current_path: Option<String>,
    pub depth: usize,
    pub limit: usize,
    pub query: Option<String>,
    pub scope: workspace_index::RelationGraphScopeDto,
}

pub fn query_workspace_backlinks(
    store: &WorkspaceIndexJobStore,
    input: QueryWorkspaceBacklinksInput,
) -> PrismResult<Vec<BacklinkDto>> {
    let index =
        completed_workspace_index_for_job(store, &input.job_id, "query_workspace_backlinks")?;
    Ok(workspace_index::get_workspace_index_backlinks(
        &index,
        &input.path,
    ))
}

pub fn query_workspace_relation_graph(
    store: &WorkspaceIndexJobStore,
    input: QueryWorkspaceRelationGraphInput,
) -> PrismResult<RelationGraphDto> {
    let index =
        completed_workspace_index_for_job(store, &input.job_id, "query_workspace_relation_graph")?;
    Ok(workspace_index::build_relation_graph(
        &index,
        BuildRelationGraphInput {
            current_path: input.current_path,
            depth: input.depth,
            limit: input.limit,
            query: input.query,
            scope: input.scope,
        },
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::path::path_to_string;
    use std::fs;
    use std::path::PathBuf;
    use std::time::Duration;

    fn temp_dir(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "prism-workspace-index-job-{}-{}-{name}",
            std::process::id(),
            now_ms()
        ));
        fs::create_dir_all(&path).expect("create temp dir");
        path
    }

    fn wait_for_finished(store: &WorkspaceIndexJobStore, job_id: &str) -> WorkspaceIndexJobDto {
        for _ in 0..100 {
            let job = get_workspace_index_job(store, job_id.to_string()).expect("get job");
            if job.status != "running" {
                return job;
            }
            thread::sleep(Duration::from_millis(5));
        }
        panic!("workspace index job did not finish");
    }

    #[test]
    fn workspace_index_job_completes_with_index() {
        let root = temp_dir("complete");
        fs::write(root.join("guide.md"), "# Guide").expect("write guide");
        let store = WorkspaceIndexJobStore::default();

        let job = start_workspace_index_job(
            &store,
            BuildWorkspaceIndexInput {
                root_path: path_to_string(&root),
                current_document_override: None,
                recent_files: vec![],
            },
        )
        .expect("start job");

        let finished = wait_for_finished(&store, &job.id);
        assert_eq!(finished.status, "completed");
        assert_eq!(finished.index.expect("index").documents[0].title, "Guide");

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn starting_new_workspace_index_job_cancels_previous_running_job_for_root() {
        let root = temp_dir("supersede");
        fs::write(root.join("guide.md"), "# Guide").expect("write guide");
        let store = WorkspaceIndexJobStore::default();
        let root_path = path_to_string(&root);
        let now = now_ms();
        let previous_job = WorkspaceIndexJobDto {
            id: "workspace-index-previous".to_string(),
            root_path: root_path.clone(),
            status: "running".to_string(),
            stage: "build".to_string(),
            message: "Building".to_string(),
            progress: 0.2,
            created_at: now,
            updated_at: now,
            completed_at: None,
            index: None,
            error: None,
            cancel_requested: false,
        };
        store.jobs.lock().expect("lock store").insert(
            previous_job.id.clone(),
            WorkspaceIndexJobEntry {
                job: previous_job.clone(),
                cancel_requested: Arc::new(AtomicBool::new(false)),
            },
        );
        let input = BuildWorkspaceIndexInput {
            root_path,
            current_document_override: None,
            recent_files: vec![],
        };

        let second = start_workspace_index_job(&store, input).expect("start second");
        let first_job = get_workspace_index_job(&store, previous_job.id).expect("get first");

        assert_eq!(first_job.status, "cancelled");
        assert_ne!(first_job.id, second.id);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn cancelling_completed_workspace_index_job_is_noop() {
        let root = temp_dir("cancel-completed");
        fs::write(root.join("guide.md"), "# Guide").expect("write guide");
        let store = WorkspaceIndexJobStore::default();

        let job = start_workspace_index_job(
            &store,
            BuildWorkspaceIndexInput {
                root_path: path_to_string(&root),
                current_document_override: None,
                recent_files: vec![],
            },
        )
        .expect("start job");
        let finished = wait_for_finished(&store, &job.id);
        let cancelled = cancel_workspace_index_job(&store, finished.id).expect("cancel job");

        assert_eq!(cancelled.status, "completed");
        assert!(cancelled.index.is_some());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn queries_backlinks_and_relation_graph_from_completed_job() {
        let root = temp_dir("query-completed");
        let current = root.join("current.md");
        let source = root.join("source.md");
        fs::write(&current, "# Current").expect("write current");
        fs::write(&source, "# Source\n\n[Current](current.md)").expect("write source");
        let store = WorkspaceIndexJobStore::default();

        let job = start_workspace_index_job(
            &store,
            BuildWorkspaceIndexInput {
                root_path: path_to_string(&root),
                current_document_override: None,
                recent_files: vec![],
            },
        )
        .expect("start job");
        let finished = wait_for_finished(&store, &job.id);

        let backlinks = query_workspace_backlinks(
            &store,
            QueryWorkspaceBacklinksInput {
                job_id: finished.id.clone(),
                path: path_to_string(&current.canonicalize().expect("canonical current")),
            },
        )
        .expect("query backlinks");
        assert_eq!(backlinks[0].title, "Source");

        let graph = query_workspace_relation_graph(
            &store,
            QueryWorkspaceRelationGraphInput {
                job_id: finished.id,
                current_path: Some(path_to_string(
                    &current.canonicalize().expect("canonical current"),
                )),
                depth: 1,
                limit: 80,
                query: None,
                scope: workspace_index::RelationGraphScopeDto::Current,
            },
        )
        .expect("query graph");
        assert_eq!(graph.nodes.len(), 2);
        assert_eq!(graph.edges.len(), 1);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn job_queries_reject_running_jobs() {
        let store = WorkspaceIndexJobStore::default();
        let now = now_ms();
        store.jobs.lock().expect("lock store").insert(
            "workspace-index-running".to_string(),
            WorkspaceIndexJobEntry {
                job: WorkspaceIndexJobDto {
                    id: "workspace-index-running".to_string(),
                    root_path: "/repo".to_string(),
                    status: "running".to_string(),
                    stage: "build".to_string(),
                    message: "Building".to_string(),
                    progress: 0.2,
                    created_at: now,
                    updated_at: now,
                    completed_at: None,
                    index: None,
                    error: None,
                    cancel_requested: false,
                },
                cancel_requested: Arc::new(AtomicBool::new(false)),
            },
        );

        let error = query_workspace_backlinks(
            &store,
            QueryWorkspaceBacklinksInput {
                job_id: "workspace-index-running".to_string(),
                path: "/repo/current.md".to_string(),
            },
        )
        .expect_err("running job should be rejected");

        assert_eq!(error.code, "workspace_index_job_not_ready");
    }
}
