# DSH Computer Use Fusion

[English](README.en.md) · [验证记录](docs/VALIDATION.md) · [来源与许可证](THIRD_PARTY_NOTICES.md)

为 DeepSeek Harness 提供接近 Codex Computer Use 的原生桌面交互：持久 JavaScript、
保存窗口对象、编号元素、真实图片附件，以及连续的观察和操作。**0.2.0** 使用 MIT 许可证。

```javascript
// 在 fusion_computer 工具的 code 参数中执行；支持顶层 await。
await cua.getState();
let app = await cua.getApp({ windowId: 12345 });
await app.getAXState();
```

后续调用直接复用 `app`：

```javascript
await app.click(12);
await app.typeText('你好');
await app.pressKey('ctrl+a');
await app.getAXStateAndScreenshot();
```

`cua` 与 `computer` 是同一对象。窗口绑定和变量跨工具调用保留，可以在一次调用内
执行多个 `await` 操作。操作默认自动激活目标；状态和截图直接显示在工具结果里。
这是独立实现的 Codex 风格原生应用 API，与 OpenAI、DeepSeek 和上游作者没有官方关联。
不包含 Codex 私有内核，也不提供浏览器 tab API。

## 0.2.0 的交互变化

删除 0.1.0 的插件审批、危险词确认、应用白名单、密码输入拦截、30 秒过期、一次性 ID、
调用者归属检查、动作前状态一致性检查，以及停止文件和恢复流程。
Windows 角落急停和 Windows 键禁用也已移除，前台输入自动处理激活。
旧的 `ttlMs`、`allowedApps`、`requireControlApproval` 配置不再参与执行。

插件仅依赖 DSH `tools` 服务，不需要 `approval` 服务。DSH 宿主及模型本身的行为由宿主管理。
系统权限、窗口不存在、输入被系统拒绝、无效参数等情况仍会返回实际错误。

## 四个项目各取所长

| 来源 | 融合内容 |
| --- | --- |
| [Anionex/dsh-computer-use](https://github.com/Anionex/dsh-computer-use) | Swift 原生 macOS AX、窗口捕获和定向输入；Fusion 修改 helper，取消状态一致性拦截并重新构建 universal binary。 |
| [988hj7tczd-oss/dsh-computer-use](https://github.com/988hj7tczd-oss/dsh-computer-use) | 可选 cua-driver 虚拟光标路径、驱动定位与会话恢复。 |
| [Yu-tao-Li/dsh-computer-use-win](https://github.com/Yu-tao-Li/dsh-computer-use-win) | 持久 PowerShell UIA、语义操作、窗口捕获和本地 OCR；补充自动前台输入与完整按键事件。 |
| [xie129716/computer-user-vision](https://github.com/xie129716/computer-user-vision) | 模型可见的真实图片附件、像素预算、准确坐标映射，以及看图操作的交互方式。 |

完整版权、固定来源版本和修改说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 安装与升级

建议 Node.js **24+**，最低 **22.19**。适配 DSH **0.2.0-rc.2**；
**0.2.1-alpha.2** 已通过宿主接口验证。

```powershell
dsh plugin --profile web add git+https://github.com/cqupi/dsh-computer-use-fusion.git
# Headless:
dsh plugin --profile headless add git+https://github.com/cqupi/dsh-computer-use-fusion.git
```

从 Git 安装的旧版，重新执行上面的 `add` 命令更新，并重启 DSH。
创建新会话，加载 `/dsh-computer-use-fusion`，让模型优先使用 `fusion_computer`。
当前没有发布 npm 包。

本地开发：

```powershell
git clone https://github.com/cqupi/dsh-computer-use-fusion.git
cd dsh-computer-use-fusion
npm ci
node scripts/doctor.mjs
dsh plugin --profile web add .
```

## 持久 JavaScript API

| API | 用途 |
| --- | --- |
| `await cua.getState()` | 返回应用和窗口清单 |
| `await cua.listWindows()` / `listApps()` | 单独列出窗口或应用 |
| `await cua.getApp({windowId})` | 绑定窗口，自动显示初始 AX/UIA 树；也接受 `{pid}`、`{bundleId}` 或窗口名字符串 |
| `await app.getAXState()` | 可读的编号元素树 |
| `await app.getScreenshot()` | 真实图片及坐标映射 |
| `await app.getAXStateAndScreenshot()` | 同时返回树和图片 |
| `await app.click(12)` | 按元素编号点击，也接受元素名字符串 |
| `await app.click([x,y], options)` | 按最近图片像素点击；`mouseButton` 和 `clickCount` 支持右键、双击 |
| `await app.typeText(text)` / `paste(text)` | Unicode 输入；`paste` 是同一文本输入路径的便利别名，不更改系统剪贴板 |
| `await app.pressKey('ctrl+a')` | 按键或组合键，Windows 支持 `win` |
| `await app.setValue(12, text)` | 语义赋值，必要时使用焦点输入 |
| `await app.invoke(12)` / `activate()` | 元素动作或窗口激活 |
| `await app.scroll(12, 'down', 3)` | 在元素位置滚动，也接受图片坐标或 `undefined` 表示窗口中心 |
| `await app.drag([x1,y1], [x2,y2])` | 拖动 |
| `await app.ocr()` | Windows 本地 OCR |
| `nodeRepl.write(value)` | 在工具结果中输出变量 |

坐标使用**最近返回图片中的像素**；插件按截图原点及缩放比例换算一次。
AX 树刷新保留最近截图映射；未取过图时，首次坐标操作自动捕获以建立映射。
窗口尺寸变化后重新取图，可以获得当前图片尺寸。图片经宿主再次缩放时也会更新映射。

JavaScript 中的动作不强制逐步观察。完成一组动作后调用状态或截图方法，查看结果。
运行错误会连同已完成的输出返回，已有变量通常仍可继续使用。
JavaScript 在持久 Node worker 中执行；宿主取消或执行超时会终止 worker，下一次调用自动新建。
普通取消不会写停止文件，也不要求人工恢复。Node worker 不是安全沙箱。

## 直接工具

也提供 `fusion_health`、`fusion_list_windows`、`fusion_observe`、`fusion_screenshot`、
`fusion_click`、`fusion_type`、`fusion_key`、`fusion_scroll`、`fusion_drag`、
`fusion_set_value`、`fusion_invoke`、`fusion_activate`、`fusion_ocr`。
先观察一个窗口，后续操作省略窗口参数即可复用目标。
`observationId` 仅作为旧接口兼容字段，既非必填，也非一次性；没有过期时间。
直接动作默认返回新树和图片，可用 `observeAfter:false` 批量执行，再单独观察。

## 平台与配置

| 后端 | 依赖与行为 | 验证范围 |
| --- | --- | --- |
| Windows（默认） | 系统 PowerShell 5.1、UIA、Win32。语义操作优先，键盘和需要坐标的操作自动激活。使用真实鼠标。 | 本机专用 WinForms 窗口，含持久 JS、Unicode 输入、键盘和密码测试控件。 |
| macOS（默认） | macOS 14+；系统 Accessibility / Screen Recording 权限。捆绑修改后构建的 arm64/x86_64 helper。 | CI 源码构建和宿主/适配器验证；尚未做真实 macOS GUI 测试。 |
| `backend:cua` | 另行安装 cua-driver，通过 PATH 或 `CUA_DRIVER_BIN` 定位；使用其虚拟光标。 | 适配器测试；尚未做真实驱动会话测试。Linux 为实验性路径。 |

```yaml
backend: auto                # auto | windows | macos | cua
timeoutMs: 30000
maxNodes: 250
vision: true
visionMaxPixels: 640000
settleMs: 100
screenshotAfterAction: true  # 直接工具的动作后截图；JS 入口由代码自行观察
```

图片通过 DSH attachments 服务交给当前图像模型；纯文本模型返回截图路径和映射。
插件没有独立模型密钥、直接网络控制接口或遥测。截图保存在系统临时目录。
原生控件是否接收了输入，应以之后的界面为准；后端也可能返回 `verified:false` 或捕获受遮挡的标记。

## 验证

```text
node scripts/validate.mjs
node scripts/host-smoke.mjs .compat/alpha
```

测试操作自己的专用窗口。完整范围见 [验证记录](docs/VALIDATION.md) 与
[架构说明](docs/ARCHITECTURE.md)。
