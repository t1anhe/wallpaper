# wallpaper

用代码生成的壁纸：**动态壁纸**（ASCII 字符画 / 十字绣，网页 + 视频）和 **静态 4K**。

打开根目录的 `index.html` 就能看到全部壁纸的画廊。

## 动态壁纸 `live/`

### ASCII 字符画

| 壁纸 | 说明 | 参数 |
| --- | --- | --- |
| **Shoal** `live/shoal.html` | 字符方块拼成的锦鲤在网格上游动：鳞片、背脊、鳃线、胸鳍尾鳍的鳍条、侧光与投影、胡须、水波。鼠标靠近鱼会被吓跑。 | `?theme=light` 浅色灰调 · `?fish=8` 鱼的数量 |
| **Isle** `live/isle.html` | 漂浮的方块小岛：小屋冒烟、树叶飘落、池塘、瀑布、云、日月；完整昼夜循环，夜里灯笼/窗户/萤石照亮周围的方块，还有萤火虫。每次打开地形都不一样。 | `?time=day/sunset/night` 固定时间 · `?day=60` 一天多少秒 · `?seed=7` 固定地形 · `?res=200` 字符更细 · `?ascii=0` 方块原版 |
| **Abyss** `live/abyss.html` | 阳光到不了的深海：黑暗里只有一只发光水母慢慢漂着，触手拖在它游过的路径后面；海洋雪只在它的光里才看得见，远处偶尔一闪微光。鼠标划过会搅起淡淡的荧光。 | `?res=200` 字符更细 · `?ascii=0` 非字符版 |

![Shoal](output/previews/shoal.jpg)
![Isle 日落](output/previews/isle-sunset.jpg)
![Abyss](output/previews/abyss-desktop.jpg)

### 十字绣

| 壁纸 | 说明 | 参数 |
| --- | --- | --- |
| **Vista** `live/vista.html` | 蓝调时刻的山谷：银河、粉色余晖的雪峰、镜面湖、湖边小镇灯火、瀑布、山脚的雾、流星、飞鸟、一叶点灯笼的小船。 | `?res=200` 针脚更细 |
| **Bloom** `live/bloom.html` | 夜里亮灯的窗，被白花藤包围：花枝随风摇、花瓣飘落、灯火摇曳、飞蛾绕光。鼠标划过像一阵风。每次打开花藤都不一样。 | `?res=200` 针脚更细 |

![Vista](output/previews/vista-desktop.jpg)
![Bloom](output/previews/bloom-desktop.jpg)

### 原理

- `live/runtime.js`：全屏 Canvas 运行时（高分屏、固定步长、鼠标、逐帧录制），外加两个通用的后期层：
  - `makeAscii`：场景按格子采样颜色，按亮度从 70 级字符里选字，边缘用 `/ \ | -` 描轮廓；半透明的部分（天空、光晕）变成稀疏的彩色字符。任何动态壁纸加 `?ascii=1` 都能变成字符画。
  - `makeStitch`：场景按"一针一像素"画，吸附到固定的绣线色，再放大并盖上布纹和十字针脚。
- `live/blocks.js`：程序生成的方块材质（草方块、泥土、石头、矿石、苔石、原木、树叶、木板、砖、屋瓦、门、窗户、灯笼、萤石、水、瀑布、雪、沙、羊毛、花、草丛、垂根）。

录好的视频在 `output/live/*.mp4`（电脑 1920×1080，手机 1080×2340）。

## Mac 应用 Wallpaper（推荐）

菜单栏小程序：把动态壁纸放到桌面图标下面，开机自动启动，自动更新。

**一键安装**：打开「终端」，粘贴下面这行，回车：

```bash
curl -fsSL https://raw.githubusercontent.com/t1anhe/wallpaper/claude/affectionate-hamilton-in1kmo/mac/install.sh | bash
```

脚本会下载最新版，放进「应用程序」文件夹，然后打开。如果装过旧的 LiveWall，会被替换掉，`~/LiveWall` 里的文件也会搬到 `~/Wallpaper`。用这种方式安装，不会弹出"无法验证开发者"的提示。

也可以手动安装：在 [Releases](https://github.com/t1anhe/wallpaper/releases/tag/mac-latest) 下载 `Wallpaper.zip`，解压后拖进「应用程序」。第一次打开要到 **系统设置 → 隐私与安全性** 里点 **「仍要打开」**。

装好后，菜单栏会出现一个 ✦ 图标，点开就能选壁纸。

**菜单**：选择壁纸 · 随机换一张 · 暂停/继续 · 打开壁纸文件夹 · 重新载入 · 检查更新 · 自动更新（默认开） · 开机自动启动（默认开） · 退出

**自动更新**：启动时检查一次，之后每 6 小时检查一次。有新版本会在后台下载、替换并重启，新壁纸也会随更新一起出现。

**添加壁纸**：所有壁纸都在 `~/Wallpaper` 文件夹，菜单里点「打开壁纸文件夹」就能打开。往里面放文件就行，下次点开菜单就会出现：

- 网页动态壁纸 `.html`（可以引用同文件夹里的 js、图片）
- 视频 `.mp4` `.mov` `.m4v`（静音循环）
- 图片 `.jpg` `.png` `.heic` `.gif` `.webp`

其他说明：

- 多显示器会同时显示；鼠标移动会传给网页壁纸，比如鱼还是会被鼠标吓跑。
- 屏幕休眠或锁屏时会自动暂停。
- 自带的壁纸在第一次启动和每次更新时会装进或刷新到 `~/Wallpaper`，你自己放进去的文件不会被改动。
- 需要 macOS 12 或更新版本，Intel 和 Apple 芯片都能用。
- 源码在 `mac/`。修改 `mac/`、`live/` 或 `lib/` 并推送后，GitHub Actions 会在 Mac 机器上重新编译，并更新 Releases 里的 `mac-latest`；装好的 App 会自动更新过去。

## 其他方式：同步到电脑并设成壁纸

**1. 下载到电脑**

- 最简单：在 GitHub 仓库页面切到分支 `claude/affectionate-hamilton-in1kmo` → `Code` → `Download ZIP`，解压。
- 或者用 git：
  ```bash
  git clone -b claude/affectionate-hamilton-in1kmo https://github.com/t1anhe/wallpaper.git
  ```
  以后有更新时进目录 `git pull` 就同步了。

**2. 设成动态壁纸**

- **Windows**：
  - [Lively Wallpaper](https://www.rocksdanister.com/lively/)（免费，微软商店可装）：拖入 `live/` 里的 `.html`（网页壁纸，可以鼠标互动），或者拖入 `output/live/*.mp4`。
  - Wallpaper Engine（Steam 付费）：编辑器 → 新建 → 选择网页类型，指向 `live/xxx.html`；或者直接导入 mp4。
- **macOS**：
  - [Plash](https://sindresorhus.com/plash)（免费，App Store）：添加网站，填 `file:///你的路径/wallpaper/live/vista.html`。
  - 或者用视频壁纸工具加载 `output/live/*.mp4`。
- **手机**：把 `output/live/*-phone.mp4` 传到手机。iPhone 可以用「转换为实况照片」类 App 把视频转成实况照片再设为壁纸；安卓多数系统或「视频动态壁纸」类 App 可以直接用视频。

## 静态壁纸 `static/`

Dunes、Bauhaus、Silk、Topography、Aurora：`output/static/*-desktop.jpg`（3840×2160）和 `*-phone.jpg`（1290×2796），右键设为壁纸即可。

## 重新生成

需要 Node.js、Playwright（Chromium）和 ffmpeg。

```bash
node render-static.js                        # 重新渲染全部静态壁纸
node record.js vista --secs 20               # 录一段 Vista 视频
node record.js isle --secs 40 --query day=40 # 录 Isle 完整的一天
node record.js shoal --size 1080x2340        # 手机尺寸
node record.js vista --stills 3,10           # 只截几帧 PNG
```
