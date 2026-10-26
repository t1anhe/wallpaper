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

## 同步到电脑并设成壁纸

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
