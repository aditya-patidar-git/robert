// Main openaiKb controller - re-exports all handlers for backward compatibility
export { getAllFiles, getFile, uploadFile, deleteFile, getFileContent, updateFileTags, upload } from './fileHandlers.js';
export { searchFiles, getVectorStoreStatus } from './searchHandlers.js';
export { reingestFile, detectFileDrift } from './operationHandlers.js';
export { addQAPair } from './qaHandlers.js';

