use crate::domain::document_io::{
    self, DocumentFileSessionDto, DocumentWriteResult, FileSnapshotDto, WriteDocumentInput,
};
use crate::domain::error::PrismResult;

#[tauri::command]
pub fn get_file_snapshot(path: String) -> PrismResult<FileSnapshotDto> {
    document_io::get_file_snapshot(path)
}

#[tauri::command]
pub fn read_document_file(path: String) -> PrismResult<DocumentFileSessionDto> {
    document_io::read_document_file(path)
}

#[tauri::command]
pub fn write_document_file(input: WriteDocumentInput) -> PrismResult<DocumentWriteResult> {
    document_io::write_document_file(input)
}
