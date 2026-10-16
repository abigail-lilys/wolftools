# JoiPlay 画面裁切修复

## 问题与根因

wolftools 导出的《魔女の遺産》在 Android JoiPlay 中出现画面裁切。

对照实验发现，基线游戏需要 1920×1080 的绘图区域，但 Browser Woditor WASM 请求的是 1280×960。实测确认问题不是单纯的 CSS 定位错误。

## 修复方法

文件：`woditor.wasm`

文件偏移：`0x829190`

将两个小端序 32 位整数从：
- 原值：`1280, 960`
- 修改为：`1920, 1080`

修改后游戏画面完整，且触摸操作正常。

## 自动修复

修复逻辑位于 `src/browser-woditor-resolution.mjs`，由 `src/web.mjs` 导出流程调用。

- 只处理 SHA-256 匹配的已知原始 WASM。
- 修改前检查原始宽高。
- 修改后验证输出 SHA-256。
- 未识别的运行时保持不变。
- 不修改缓存中的原始 ZIP。

原始 WASM SHA-256：
`95885d4527086cc18d92bfe3ca7e206b8769444ffa4a9c035c24f637c3e93ace`

修复后 WASM SHA-256：
`8e05c81b155384b612a1de4c46181c98303df7740601796f5ec5e5158287f135`

## 验证

运行以下命令检查语法和测试：`node --check src/web.mjs`、`node --check src/browser-woditor-resolution.mjs`、`npm test`。

重新导出后检查：`sha256sum "/path/to/export/woditor.wasm"`

预期 SHA-256 为上述修复后哈希。最后还应在 JoiPlay 中验证标题画面、游戏场景和触摸操作。

### 适用范围

目前只对已验证的 Browser Woditor 0.6.2.0 WASM 版本自动应用修复。其他版本必须单独检查与验证。
