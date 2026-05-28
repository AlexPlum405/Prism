use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use super::error::{PrismCommandError, PrismResult};

static NEXT_EXPORT_JOB_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExportJobDto {
    pub id: String,
    pub format: String,
    pub document_path: Option<String>,
    pub output_path: Option<String>,
    pub status: String,
    pub stage: String,
    pub message: String,
    pub created_at: u64,
    pub updated_at: u64,
    pub error: Option<PrismCommandError>,
    pub cancel_requested: bool,
}

#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreateExportJobInput {
    pub format: String,
    pub document_path: Option<String>,
    pub output_path: Option<String>,
    pub stage: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateExportJobInput {
    pub id: String,
    pub output_path: Option<String>,
    pub stage: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CompleteExportJobInput {
    pub id: String,
    pub output_path: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FailExportJobInput {
    pub id: String,
    pub stage: Option<String>,
    pub message: Option<String>,
    pub error: PrismCommandError,
}

#[derive(Default)]
pub struct ExportJobStore {
    jobs: Mutex<HashMap<String, ExportJobDto>>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or(0)
}

fn next_job_id() -> String {
    let sequence = NEXT_EXPORT_JOB_ID.fetch_add(1, Ordering::Relaxed);
    format!("export-{}-{sequence}", now_ms())
}

fn store_lock_error() -> PrismCommandError {
    PrismCommandError::new(
        "export_job_store_locked",
        "Export job store is temporarily unavailable",
    )
    .with_stage("export_job")
}

fn missing_job_error(job_id: &str) -> PrismCommandError {
    PrismCommandError::new("export_job_not_found", "Export job does not exist")
        .with_hint("Start a new export and try again.")
        .with_stage("export_job")
        .with_path(job_id)
}

fn update_job<F>(store: &ExportJobStore, job_id: &str, update: F) -> PrismResult<ExportJobDto>
where
    F: FnOnce(&mut ExportJobDto, u64),
{
    let mut jobs = store.jobs.lock().map_err(|_| store_lock_error())?;
    let job = jobs
        .get_mut(job_id)
        .ok_or_else(|| missing_job_error(job_id))?;
    let updated_at = now_ms();
    update(job, updated_at);
    job.updated_at = updated_at;
    Ok(job.clone())
}

pub fn create_export_job(
    store: &ExportJobStore,
    input: CreateExportJobInput,
) -> PrismResult<ExportJobDto> {
    let now = now_ms();
    let job = ExportJobDto {
        id: next_job_id(),
        format: input.format,
        document_path: input.document_path,
        output_path: input.output_path,
        status: "running".to_string(),
        stage: input.stage.unwrap_or_else(|| "prepare".to_string()),
        message: input.message.unwrap_or_default(),
        created_at: now,
        updated_at: now,
        error: None,
        cancel_requested: false,
    };

    let mut jobs = store.jobs.lock().map_err(|_| store_lock_error())?;
    jobs.insert(job.id.clone(), job.clone());
    Ok(job)
}

pub fn update_export_job(
    store: &ExportJobStore,
    input: UpdateExportJobInput,
) -> PrismResult<ExportJobDto> {
    update_job(store, &input.id, |job, _| {
        if let Some(output_path) = input.output_path {
            job.output_path = Some(output_path);
        }
        if let Some(stage) = input.stage {
            job.stage = stage;
        }
        if let Some(message) = input.message {
            job.message = message;
        }
    })
}

pub fn complete_export_job(
    store: &ExportJobStore,
    input: CompleteExportJobInput,
) -> PrismResult<ExportJobDto> {
    update_job(store, &input.id, |job, _| {
        job.status = "completed".to_string();
        job.stage = "completed".to_string();
        if let Some(output_path) = input.output_path {
            job.output_path = Some(output_path);
        }
        if let Some(message) = input.message {
            job.message = message;
        }
        job.error = None;
        job.cancel_requested = false;
    })
}

pub fn fail_export_job(
    store: &ExportJobStore,
    input: FailExportJobInput,
) -> PrismResult<ExportJobDto> {
    update_job(store, &input.id, |job, _| {
        job.status = "failed".to_string();
        job.stage = input.stage.unwrap_or_else(|| "failed".to_string());
        job.message = input.message.unwrap_or_else(|| input.error.message.clone());
        job.error = Some(input.error);
    })
}

pub fn cancel_export_job(store: &ExportJobStore, job_id: String) -> PrismResult<ExportJobDto> {
    update_job(store, &job_id, |job, _| {
        job.status = "cancelled".to_string();
        job.stage = "cancel_requested".to_string();
        job.message = "Export cancellation requested".to_string();
        job.cancel_requested = true;
    })
}

pub fn get_export_job(store: &ExportJobStore, job_id: String) -> PrismResult<ExportJobDto> {
    let jobs = store.jobs.lock().map_err(|_| store_lock_error())?;
    jobs.get(&job_id)
        .cloned()
        .ok_or_else(|| missing_job_error(&job_id))
}

pub fn list_export_jobs(store: &ExportJobStore) -> PrismResult<Vec<ExportJobDto>> {
    let jobs = store.jobs.lock().map_err(|_| store_lock_error())?;
    let mut list = jobs.values().cloned().collect::<Vec<_>>();
    list.sort_by(|a, b| a.created_at.cmp(&b.created_at).then(a.id.cmp(&b.id)));
    Ok(list)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_pdf_job(store: &ExportJobStore) -> ExportJobDto {
        create_export_job(
            store,
            CreateExportJobInput {
                format: "pdf".to_string(),
                document_path: Some("/tmp/source.md".to_string()),
                output_path: Some("/tmp/source.pdf".to_string()),
                stage: Some("prepare".to_string()),
                message: Some("Preparing export".to_string()),
            },
        )
        .expect("create export job")
    }

    #[test]
    fn create_update_and_complete_export_jobs() {
        let store = ExportJobStore::default();
        let created = create_pdf_job(&store);

        assert_eq!(created.format, "pdf");
        assert_eq!(created.status, "running");
        assert_eq!(created.stage, "prepare");
        assert!(!created.cancel_requested);

        let updated = update_export_job(
            &store,
            UpdateExportJobInput {
                id: created.id.clone(),
                output_path: None,
                stage: Some("render_diagrams".to_string()),
                message: Some("Rendering diagrams".to_string()),
            },
        )
        .expect("update export job");

        assert_eq!(updated.stage, "render_diagrams");
        assert_eq!(updated.message, "Rendering diagrams");

        let completed = complete_export_job(
            &store,
            CompleteExportJobInput {
                id: created.id.clone(),
                output_path: None,
                message: Some("Export completed".to_string()),
            },
        )
        .expect("complete export job");

        assert_eq!(completed.status, "completed");
        assert_eq!(completed.stage, "completed");
        assert_eq!(completed.message, "Export completed");
        assert_eq!(completed.error, None);
    }

    #[test]
    fn fail_and_cancel_export_jobs() {
        let store = ExportJobStore::default();
        let failed_job = create_pdf_job(&store);
        let failed = fail_export_job(
            &store,
            FailExportJobInput {
                id: failed_job.id.clone(),
                stage: Some("render".to_string()),
                message: None,
                error: PrismCommandError::new("export_failed", "Render failed")
                    .with_stage("render"),
            },
        )
        .expect("fail export job");

        assert_eq!(failed.status, "failed");
        assert_eq!(failed.stage, "render");
        assert_eq!(failed.message, "Render failed");
        assert_eq!(
            failed.error.as_ref().map(|error| error.code.as_str()),
            Some("export_failed")
        );

        let cancelling_job = create_pdf_job(&store);
        let cancelled = cancel_export_job(&store, cancelling_job.id.clone()).expect("cancel job");

        assert_eq!(cancelled.status, "cancelled");
        assert!(cancelled.cancel_requested);
    }

    #[test]
    fn list_and_missing_export_jobs() {
        let store = ExportJobStore::default();
        let first = create_pdf_job(&store);
        let second = create_export_job(
            &store,
            CreateExportJobInput {
                format: "html".to_string(),
                document_path: None,
                output_path: None,
                stage: None,
                message: None,
            },
        )
        .expect("create second export job");

        let jobs = list_export_jobs(&store).expect("list export jobs");
        assert_eq!(
            jobs.iter().map(|job| job.id.as_str()).collect::<Vec<_>>(),
            vec![first.id.as_str(), second.id.as_str()]
        );

        let error = get_export_job(&store, "missing".to_string()).expect_err("missing job");
        assert_eq!(error.code, "export_job_not_found");
    }
}
