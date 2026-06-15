use tauri::State;

use crate::domain::error::PrismResult;
use crate::domain::workspace_index::{
    self, BacklinkDto, BuildWorkspaceIndexInput, QueryWorkspaceIndexInput, RelationGraphDto,
    WorkspaceIndexDto, WorkspaceIndexSearchResultDto,
};
use crate::domain::workspace_index_job::{
    self, QueryWorkspaceBacklinksInput, QueryWorkspaceRelationGraphInput, WorkspaceIndexJobDto,
    WorkspaceIndexJobStore,
};

#[tauri::command]
pub fn build_workspace_index(input: BuildWorkspaceIndexInput) -> PrismResult<WorkspaceIndexDto> {
    workspace_index::build_workspace_index(input)
}

#[tauri::command]
pub fn query_workspace_index(
    input: QueryWorkspaceIndexInput,
) -> PrismResult<Vec<WorkspaceIndexSearchResultDto>> {
    workspace_index::query_workspace_index(input)
}

#[tauri::command]
pub fn start_workspace_index_job(
    store: State<'_, WorkspaceIndexJobStore>,
    input: BuildWorkspaceIndexInput,
) -> PrismResult<WorkspaceIndexJobDto> {
    workspace_index_job::start_workspace_index_job(&store, input)
}

#[tauri::command]
pub fn get_workspace_index_job(
    store: State<'_, WorkspaceIndexJobStore>,
    job_id: String,
) -> PrismResult<WorkspaceIndexJobDto> {
    workspace_index_job::get_workspace_index_job(&store, job_id)
}

#[tauri::command]
pub fn cancel_workspace_index_job(
    store: State<'_, WorkspaceIndexJobStore>,
    job_id: String,
) -> PrismResult<WorkspaceIndexJobDto> {
    workspace_index_job::cancel_workspace_index_job(&store, job_id)
}

#[tauri::command]
pub fn query_workspace_backlinks(
    store: State<'_, WorkspaceIndexJobStore>,
    input: QueryWorkspaceBacklinksInput,
) -> PrismResult<Vec<BacklinkDto>> {
    workspace_index_job::query_workspace_backlinks(&store, input)
}

#[tauri::command]
pub fn query_workspace_relation_graph(
    store: State<'_, WorkspaceIndexJobStore>,
    input: QueryWorkspaceRelationGraphInput,
) -> PrismResult<RelationGraphDto> {
    workspace_index_job::query_workspace_relation_graph(&store, input)
}
