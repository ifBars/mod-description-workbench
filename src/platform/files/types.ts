export interface FileFilter {
  name: string
  extensions: string[]
}

export interface SelectedFile {
  name: string
  bytes: Uint8Array
}

export type FileSelection =
  | { cancelled: true }
  | { cancelled: false; file: SelectedFile }

export interface ChooseFileRequest {
  filters: FileFilter[]
}

export interface SaveFileRequest {
  filename: string
  mimeType: string
  bytes: Uint8Array
  filters: FileFilter[]
}

export type SaveFileResult = { cancelled: boolean }

export interface FilePlatform {
  chooseFile(request: ChooseFileRequest): Promise<FileSelection>
  saveFile(request: SaveFileRequest): Promise<SaveFileResult>
}
