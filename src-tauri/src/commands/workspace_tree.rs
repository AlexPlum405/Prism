use crate::domain::error::PrismResult;
use crate::domain::workspace_tree::{self, FileNodeDto, LoadWorkspaceTreeOptions};

#[tauri::command]
pub fn load_workspace_tree(
    root_path: String,
    options: Option<LoadWorkspaceTreeOptions>,
) -> PrismResult<Vec<FileNodeDto>> {
    workspace_tree::load_workspace_tree(root_path, options)
}
