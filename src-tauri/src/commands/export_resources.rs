use crate::domain::error::PrismResult;
use crate::domain::export_resources::{
    self, ExportResourceDiagnosticDto, PreflightExportInput, ResolveResourceInput,
    ResourceBytesDto, ResourceRefDto,
};

#[tauri::command]
pub fn resolve_export_resource(input: ResolveResourceInput) -> PrismResult<ResourceRefDto> {
    export_resources::resolve_export_resource(input)
}

#[tauri::command]
pub fn read_export_resource(input: ResolveResourceInput) -> PrismResult<ResourceBytesDto> {
    export_resources::read_export_resource(input)
}

#[tauri::command]
pub fn preflight_export(
    input: PreflightExportInput,
) -> PrismResult<Vec<ExportResourceDiagnosticDto>> {
    export_resources::preflight_export(input)
}
