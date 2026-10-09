export interface FolderCount {
  files: number;
  children: number;
}

export interface Folder {
  id: string;
  name: string;
  projectId: string;
  parentId: string | null;
  createdAt: string;
  _count: FolderCount;
}

export interface Uploader {
  id: string;
  name: string | null;
  email: string;
}

export interface VersionEntry {
  id: string;
  fileId: string;
  version: number;
  path: string;
  size: number;
  note: string | null;
  uploadedById: string;
  uploadedBy: Uploader;
  createdAt: string;
}

export interface FileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  clientVisible: boolean;
  folderId: string | null;
  createdAt: string;
  uploadedBy: Uploader;
  versions: { version: number }[];
}

export interface Breadcrumb {
  id: string | null;
  name: string;
}
