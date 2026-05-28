use tauri::State;

use crate::domain::error::PrismResult;
use crate::domain::export_job::{
    self, CompleteExportJobInput, CreateExportJobInput, ExportJobDto, ExportJobStore,
    FailExportJobInput, UpdateExportJobInput,
};

#[tauri::command]
pub fn create_export_job(
    store: State<'_, ExportJobStore>,
    input: CreateExportJobInput,
) -> PrismResult<ExportJobDto> {
    export_job::create_export_job(&store, input)
}

#[tauri::command]
pub fn update_export_job(
    store: State<'_, ExportJobStore>,
    input: UpdateExportJobInput,
) -> PrismResult<ExportJobDto> {
    export_job::update_export_job(&store, input)
}

#[tauri::command]
pub fn complete_export_job(
    store: State<'_, ExportJobStore>,
    input: CompleteExportJobInput,
) -> PrismResult<ExportJobDto> {
    export_job::complete_export_job(&store, input)
}

#[tauri::command]
pub fn fail_export_job(
    store: State<'_, ExportJobStore>,
    input: FailExportJobInput,
) -> PrismResult<ExportJobDto> {
    export_job::fail_export_job(&store, input)
}

#[tauri::command]
pub fn cancel_export_job(
    store: State<'_, ExportJobStore>,
    job_id: String,
) -> PrismResult<ExportJobDto> {
    export_job::cancel_export_job(&store, job_id)
}

#[tauri::command]
pub fn get_export_job(
    store: State<'_, ExportJobStore>,
    job_id: String,
) -> PrismResult<ExportJobDto> {
    export_job::get_export_job(&store, job_id)
}

#[tauri::command]
pub fn list_export_jobs(store: State<'_, ExportJobStore>) -> PrismResult<Vec<ExportJobDto>> {
    export_job::list_export_jobs(&store)
}
