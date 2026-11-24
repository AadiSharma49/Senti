import { EDITOR_COMMANDS, MAX_PATH_LENGTH, type EditorAction } from '../../shared/codeBridgeActions'

const descriptions: Record<EditorAction, string> = {
  read_file: 'Read a named text file from the paired VS Code workspace. For the active editor use get_active_file instead.',
  write_file: 'Create or replace a text file in the paired workspace when explicitly asked. Supply the complete text, never a patch or partial content. The editor asks for approval.',
  list_files: 'List files in the paired workspace root, or in the specified relative directory.',
  run_tests: 'Run the configured test task in the paired workspace (e.g. “run my tests”). No command, flags or arguments.',
  get_active_file: 'Read the active file in the paired VS Code editor, e.g. “read my active file”. Do not take a screenshot or guess a path.',
  get_diagnostics: 'Get editor diagnostics for the paired VS Code workspace.',
  open_editor_file: 'Open a workspace-relative file in the paired VS Code editor. This is not an OS file search.',
  get_git_status: 'Get the Git status of the paired workspace.',
}
const path = { type: 'string', maxLength: MAX_PATH_LENGTH, description: 'Path relative to the open workspace folder, not an absolute path or URI.' }
const text = { type: 'string', description: 'Complete UTF-8 file contents (up to 64 KiB); the empty string writes an empty file.' }

export const EDITOR_TOOLS = (Object.keys(EDITOR_COMMANDS) as EditorAction[]).map(name => {
  const hasPath = ['write_file', 'read_file', 'list_files', 'open_editor_file'].includes(name)
  return {
    type: 'function',
    function: {
      name, description: descriptions[name],
      parameters: {
        type: 'object', additionalProperties: false,
        properties: name === 'write_file' ? { path, text } : hasPath ? { path } : {},
        required: name === 'write_file' ? ['path', 'text'] : hasPath && name !== 'list_files' ? ['path'] : [],
      },
    },
  }
})
