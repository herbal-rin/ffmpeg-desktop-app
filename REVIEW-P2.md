# P2 Review Notes

## ❌ Blocking issue – path escaping breaks ffmpeg execution

`ArgsBuilder.buildFullArgs` and the newly added `PreviewService` both call `PathEscapeUtils.escapeInputPath/escapeOutputPath` before
passing the strings to `child_process.spawn` (shell disabled). The helper currently escapes characters such as `:` and spaces by inserting
backslashes (e.g. `C:\\Videos\\my clip.mp4` becomes `C\:\\Videos\\my\ clip.mp4`). Because `spawn` already sends each array element as a
literal argument, these extra backslashes reach ffmpeg unchanged, so any Windows drive letter or path containing spaces is mis-read and
ffmpeg immediately fails with “No such file or directory”.

This regression affects every encode/preview job on Windows (drive letter `C:` becomes `C\:`) and also breaks common POSIX paths that have
spaces. The bug blocks P0/P1/P2 end-to-end usage.

Key locations:
- `app/services/ffmpeg/argsBuilder.ts` – `escapeInputPath`/`escapeOutputPath` usage when building the main transcode command.
- `app/services/ffmpeg/pathEscapeUtils.ts` – replaces `:` and whitespace with escaped variants even though `spawn` is invoked with `shell:false`.
- `app/main/previewService.ts` – reuses the same escaping for preview generation, so the tools page cannot render previews for the same inputs.

Please remove the manual escaping (or only escape when constructing filtergraph strings) and pass the raw absolute paths to `spawn`.
