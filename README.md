# wallpaper

用代码生成的壁纸：**动态壁纸**（ASCII 字符画 / 十字绣，网页 + 视频）和 **静态 4K**。

打开根目录的 `index.html` 就能看到全部壁纸的画廊。

## 动态壁纸 `live/`

### ASCII 字符画

| 壁纸 | 说明 | 参数 |
| --- | --- | --- |
| **Shoal** `live/shoal.html` | 字符方块拼成的锦鲤在网格上游动：鳞片、背脊、鳃线、胸鳍尾鳍的鳍条、侧光与投影、胡须、水波。鼠标靠近鱼会被吓跑。 | `?theme=light` 浅色灰调 · `?fish=8` 鱼的数量 |
| **Isle** `live/isle.html` | 漂浮的方块小岛：小屋冒烟、树叶飘落、池塘、瀑布、云、日月；完整昼夜循环，夜里灯笼/窗户/萤石照亮周围的方块，还有萤火虫。每次打开地形都不一样。 | `?time=day/sunset/night` 固定时间 · `?day=60` 一天多少秒 · `?seed=7` 固定地形 · `?res=200` 字符更细 · `?ascii=0` 方块原版 |

![Shoal](output/previews/shoal.jpg)
![Isle 日落](output/previews/isle-sunset.jpg)

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

## Mac 应用 LiveWall（推荐）

菜单栏小程序：把动态壁纸放到桌面图标下面，开机自动启动。

**安装**

1. 打开仓库的 [Releases](https://github.com/t1anhe/wallpaper/releases/tag/mac-latest) 页面，下载 `LiveWall.zip`，双击解压。
2. 把 `LiveWall` 拖进「应用程序」文件夹，然后打开它。
3. 第一次打开时，macOS 会提示"无法验证开发者"（这个 App 没有付费的苹果开发者签名）：打开 **系统设置 → 隐私与安全性**，往下找到 LiveWall，点 **「仍要打开」**。只需要这一次。
   - 也可以在终端运行一次：`xattr -dr com.apple.quarantine /Applications/LiveWall.app`
4. 菜单栏会出现一个 ✦ 图标，点开就能选壁纸。

**菜单**：选择壁纸 · 随机换一张 · 暂停/继续 · 打开壁纸文件夹 · 重新载入 · 开机自动启动（默认开） · 退出

**添加壁纸**：所有壁纸都在 `~/LiveWall` 文件夹（菜单里「打开壁纸文件夹」）。往里面放文件就行，下次点开菜单就会出现：

- 网页动态壁纸 `.html`（可以引用同文件夹里的 js、图片）
- 视频 `.mp4` `.mov` `.m4v`（静音循环）
- 图片 `.jpg` `.png` `.heic` `.gif` `.webp`

其他说明：

- 多显示器会同时显示，鼠标移动会传给网页壁纸，比如鱼还是会被鼠标吓跑。
- 屏幕休眠、锁屏时自动暂停。
- 自带的壁纸在第一次启动和 App 更新时会装进或刷新到 `~/LiveWall`，你自己放进去的文件不会被改动。
- 需要 macOS 12 或更新版本，Intel 和 Apple 芯片都能用。
- 源码在 `mac/`。每次修改 `mac/`、`live/`、`lib/` 并推送后，GitHub Actions 会在 Mac 机器上重新编译，并更新 Releases 里的 `mac-latest`。

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
