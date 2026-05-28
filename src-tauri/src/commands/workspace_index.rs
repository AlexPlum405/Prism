use crate::domain::error::PrismResult;
use crate::domain::workspace_index::{self, BuildWorkspaceIndexInput, WorkspaceIndexDto};

#[tauri::command]
pub fn build_workspace_index(input: BuildWorkspaceIndexInput) -> PrismResult<WorkspaceIndexDto> {
    workspace_index::build_workspace_index(input)
}
