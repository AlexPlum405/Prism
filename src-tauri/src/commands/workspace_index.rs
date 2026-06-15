use crate::domain::error::PrismResult;
use crate::domain::workspace_index::{
    self, BuildWorkspaceIndexInput, QueryWorkspaceIndexInput, WorkspaceIndexDto,
    WorkspaceIndexSearchResultDto,
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
