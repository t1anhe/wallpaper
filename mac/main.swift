// Wallpaper — a menu bar app that puts live wallpapers behind the desktop icons.
//
// Wallpapers live in ~/Wallpaper. Anything dropped in there (or a subfolder) shows up in the menu
// the next time it is opened: web pages (.html), videos (.mp4/.mov/.m4v) and images.
// The wallpapers bundled with the app are copied in on first launch and refreshed on updates;
// files the user adds are never touched.

import AVFoundation
import Cocoa
import ServiceManagement
import WebKit

let wallpaperDir = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Wallpaper", isDirectory: true)
/// Where the app kept its wallpapers when it was called LiveWall; moved over on first launch.
let legacyDir = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("LiveWall", isDirectory: true)
let defaults = UserDefaults.standard

// MARK: - Wallpaper files

enum Kind: Int {
    case web, video, image
}

struct Wallpaper {
    let path: String  // relative to wallpaperDir
    let kind: Kind

    var url: URL { wallpaperDir.appendingPathComponent(path) }
    var title: String {
        (path as NSString).lastPathComponent
            .components(separatedBy: ".").dropLast().joined(separator: ".")
            .split(whereSeparator: { $0 == "-" || $0 == "_" })
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
    }
}

func kind(of path: String) -> Kind? {
    switch (path as NSString).pathExtension.lowercased() {
    case "html", "htm": return .web
    case "mp4", "mov", "m4v": return .video
    case "jpg", "jpeg", "png", "heic", "gif", "webp", "tif", "tiff": return .image
    default: return nil
    }
}

func scanWallpapers() -> [Wallpaper] {
    let paths = FileManager.default.subpaths(atPath: wallpaperDir.path) ?? []
    return paths
        .filter { path in
            let parts = path.split(separator: "/")
            // lib/ holds shared scripts; hidden files and deep nesting are noise
            return parts.first != "lib" && !parts.contains { $0.hasPrefix(".") } && parts.count <= 4
        }
        .compactMap { path in kind(of: path).map { Wallpaper(path: path, kind: $0) } }
        .sorted { ($0.kind.rawValue, $0.title.lowercased()) < ($1.kind.rawValue, $1.title.lowercased()) }
}

/// Copy the wallpapers shipped inside the app into ~/Wallpaper on first run and after updates.
func installBundledWallpapers() {
    let fm = FileManager.default
    guard let src = Bundle.main.resourceURL?.appendingPathComponent("Wallpapers") else { return }
    let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0"
    if !fm.fileExists(atPath: wallpaperDir.path) && fm.fileExists(atPath: legacyDir.path) {
        try? fm.moveItem(at: legacyDir, to: wallpaperDir)
    }
    let firstRun = !fm.fileExists(atPath: wallpaperDir.path)
    try? fm.createDirectory(at: wallpaperDir, withIntermediateDirectories: true)
    guard firstRun || defaults.string(forKey: "installedVersion") != version else { return }
    for rel in fm.subpaths(atPath: src.path) ?? [] {
        let from = src.appendingPathComponent(rel)
        let to = wallpaperDir.appendingPathComponent(rel)
        var isDir: ObjCBool = false
        fm.fileExists(atPath: from.path, isDirectory: &isDir)
        if isDir.boolValue {
            try? fm.createDirectory(at: to, withIntermediateDirectories: true)
        } else {
            try? fm.removeItem(at: to)
            try? fm.copyItem(at: from, to: to)
        }
    }
    let readme = """
    Wallpaper 壁纸文件夹

    把壁纸文件放进这个文件夹（或任意子文件夹），点开菜单栏的 Wallpaper 图标就能看到并切换：
      · 网页动态壁纸：.html（可以引用同文件夹里的 .js / 图片等文件）
      · 视频：.mp4 .mov .m4v（静音循环播放）
      · 图片：.jpg .png .heic .gif .webp

    lib 文件夹是内置动态壁纸共用的脚本，请不要删除。
    App 更新时会刷新自带的壁纸文件，你自己放进来的文件不会被改动。
    """
    try? readme.write(to: wallpaperDir.appendingPathComponent("使用说明.txt"), atomically: true, encoding: .utf8)
    defaults.set(version, forKey: "installedVersion")
}

// MARK: - Launch at login

enum LoginItem {
    static let label = "com.t1anhe.wallpaper"
    static var agentURL: URL {
        FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/LaunchAgents/\(label).plist")
    }

    static var isEnabled: Bool {
        if #available(macOS 13.0, *) { return SMAppService.mainApp.status == .enabled }
        return FileManager.default.fileExists(atPath: agentURL.path)
    }

    static func set(_ on: Bool) {
        if #available(macOS 13.0, *) {
            do {
                if on { try SMAppService.mainApp.register() } else { try SMAppService.mainApp.unregister() }
            } catch {
                NSLog("Wallpaper: login item change failed: \(error)")
            }
            return
        }
        if on {
            let plist: NSDictionary = ["Label": label, "ProgramArguments": [Bundle.main.executablePath ?? ""], "RunAtLoad": true]
            try? FileManager.default.createDirectory(at: agentURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            _ = plist.write(to: agentURL, atomically: true)
        } else {
            try? FileManager.default.removeItem(at: agentURL)
        }
    }
}

// MARK: - Updates

let releaseAPI = "https://api.github.com/repos/t1anhe/wallpaper/releases/tags/mac-latest"
let currentBuild = Int(Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "") ?? 0

// MARK: - One wallpaper on one screen

final class DesktopWindow: NSWindow {
    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }
}

final class Surface: NSObject, WKNavigationDelegate {
    let window: DesktopWindow
    private var web: WKWebView?
    private var player: AVQueuePlayer?
    private var looper: AVPlayerLooper?
    private var paused = false

    init(screen: NSScreen, wallpaper: Wallpaper) {
        window = DesktopWindow(contentRect: screen.frame, styleMask: .borderless, backing: .buffered, defer: false)
        super.init()
        // Just under the desktop icons, above the system wallpaper
        window.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) - 1)
        window.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        window.ignoresMouseEvents = true
        window.isOpaque = true
        window.hasShadow = false
        window.backgroundColor = .black
        window.isReleasedWhenClosed = false
        window.setFrame(screen.frame, display: false)

        let content = NSView(frame: NSRect(origin: .zero, size: screen.frame.size))
        content.wantsLayer = true
        content.layer?.backgroundColor = NSColor.black.cgColor
        window.contentView = content

        switch wallpaper.kind {
        case .web:
            let config = WKWebViewConfiguration()
            config.mediaTypesRequiringUserActionForPlayback = []
            let web = WKWebView(frame: content.bounds, configuration: config)
            web.autoresizingMask = [.width, .height]
            web.alphaValue = 0  // fade in once loaded, instead of flashing white
            web.navigationDelegate = self
            content.addSubview(web)
            web.loadFileURL(wallpaper.url, allowingReadAccessTo: wallpaperDir)
            self.web = web
        case .video:
            let player = AVQueuePlayer()
            player.isMuted = true
            looper = AVPlayerLooper(player: player, templateItem: AVPlayerItem(url: wallpaper.url))
            let layer = AVPlayerLayer(player: player)
            layer.videoGravity = .resizeAspectFill
            layer.frame = content.bounds
            layer.autoresizingMask = [.layerWidthSizable, .layerHeightSizable]
            content.layer?.addSublayer(layer)
            player.play()
            self.player = player
        case .image:
            let layer = CALayer()
            layer.contents = NSImage(contentsOf: wallpaper.url)
            layer.contentsGravity = .resizeAspectFill
            layer.frame = content.bounds
            layer.autoresizingMask = [.layerWidthSizable, .layerHeightSizable]
            content.layer?.addSublayer(layer)
        }
        window.orderFrontRegardless()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.6
            webView.animator().alphaValue = 1
        }
        if paused { setPaused(true) }
    }

    func setPaused(_ p: Bool) {
        paused = p
        web?.evaluateJavaScript("window.LIVE_PAUSED = \(p)", completionHandler: nil)
        if let player = player {
            if p { player.pause() } else { player.play() }
        }
    }

    /// Forward the global mouse position so pages can react to it (the window itself ignores the mouse).
    func pointer(at p: NSPoint) {
        guard let web = web, window.frame.contains(p) else { return }
        let x = p.x - window.frame.minX, y = window.frame.maxY - p.y
        web.evaluateJavaScript("window.dispatchEvent(new PointerEvent('pointermove', { clientX: \(x), clientY: \(y) }))", completionHandler: nil)
    }

    func close() {
        player?.pause()
        web?.stopLoading()
        window.orderOut(nil)
        window.close()
    }
}

// MARK: - App

final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var statusItem: NSStatusItem!
    private var surfaces: [Surface] = []
    private var listed: [Wallpaper] = []
    private var paused = defaults.bool(forKey: "paused")
    private var asleep = false
    private var lastPointer: TimeInterval = 0
    private var mouseMonitor: Any?
    private var updateStatus = "版本 build \(currentBuild)"
    private var updating = false
    private var updateTimer: Timer?
    private let session = URLSession(configuration: .ephemeral)

    private var currentPath: String? {
        get { defaults.string(forKey: "current") }
        set { defaults.set(newValue, forKey: "current") }
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        if Bundle.main.bundlePath.contains("/AppTranslocation/") {
            let alert = NSAlert()
            alert.messageText = "请先把 Wallpaper 拖进「应用程序」文件夹"
            alert.informativeText = "从「下载」文件夹直接打开时，开机启动等功能无法正常工作。移动后再从「应用程序」里打开即可。"
            alert.runModal()
        }
        defaults.register(defaults: ["autoUpdate": true])
        installBundledWallpapers()
        if !defaults.bool(forKey: "loginConfigured") {
            defaults.set(true, forKey: "launchAtLogin")
            defaults.set(true, forKey: "loginConfigured")
        }
        // Re-assert on every launch: an update swaps the app bundle, which can drop the login item
        if defaults.bool(forKey: "launchAtLogin") && !LoginItem.isEnabled { LoginItem.set(true) }

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "sparkles", accessibilityDescription: "Wallpaper")
            button.image?.isTemplate = true
        }
        let menu = NSMenu()
        menu.delegate = self
        statusItem.menu = menu

        NotificationCenter.default.addObserver(forName: NSApplication.didChangeScreenParametersNotification, object: nil, queue: .main) { [weak self] _ in
            self?.show()
        }
        let ws = NSWorkspace.shared.notificationCenter
        for (name, sleeping) in [
            (NSWorkspace.screensDidSleepNotification, true), (NSWorkspace.screensDidWakeNotification, false),
            (NSWorkspace.sessionDidResignActiveNotification, true), (NSWorkspace.sessionDidBecomeActiveNotification, false),
        ] {
            ws.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                self?.asleep = sleeping
                self?.applyPause()
            }
        }
        mouseMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.mouseMoved, .leftMouseDragged]) { [weak self] _ in
            guard let self = self else { return }
            let now = ProcessInfo.processInfo.systemUptime
            guard now - self.lastPointer > 1.0 / 30 else { return }
            self.lastPointer = now
            let p = NSEvent.mouseLocation
            self.surfaces.forEach { $0.pointer(at: p) }
        }
        show()

        DispatchQueue.main.asyncAfter(deadline: .now() + 15) { [weak self] in self?.checkForUpdate(manual: false) }
        updateTimer = Timer.scheduledTimer(withTimeInterval: 6 * 3600, repeats: true) { [weak self] _ in
            self?.checkForUpdate(manual: false)
        }
    }

    // MARK: Updates

    private func githubRequest(_ url: String, accept: String) -> URLRequest {
        var req = URLRequest(url: URL(string: url)!)
        req.setValue(accept, forHTTPHeaderField: "Accept")
        return req
    }

    private func checkForUpdate(manual: Bool) {
        guard !updating, !Bundle.main.bundlePath.contains("/AppTranslocation/") else { return }
        session.dataTask(with: githubRequest(releaseAPI, accept: "application/vnd.github+json")) { data, resp, _ in
            let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
            let json = data.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
            DispatchQueue.main.async { self.handleRelease(json, status: status, manual: manual) }
        }.resume()
    }

    private func handleRelease(_ json: [String: Any]?, status: Int, manual: Bool) {
        guard status == 200, let json = json else {
            updateStatus = "检查更新失败（网络不通？）"
            if manual { tell(updateStatus) }
            return
        }
        // Release title looks like "Wallpaper for Mac (build 12)"
        let name = json["name"] as? String ?? ""
        let build = Int(name.components(separatedBy: "build ").last?.filter { $0.isNumber } ?? "") ?? 0
        let assets = json["assets"] as? [[String: Any]] ?? []
        guard build > currentBuild,
              let asset = assets.first(where: { ($0["name"] as? String)?.hasSuffix(".zip") == true }),
              let assetURL = asset["url"] as? String
        else {
            updateStatus = "已是最新版本（build \(currentBuild)）"
            if manual { tell(updateStatus) }
            return
        }
        guard manual || defaults.bool(forKey: "autoUpdate") else {
            updateStatus = "有新版本 build \(build)，点「检查更新」安装"
            return
        }
        updating = true
        updateStatus = "正在下载 build \(build)…"
        session.downloadTask(with: githubRequest(assetURL, accept: "application/octet-stream")) { tmp, resp, _ in
            let fm = FileManager.default
            let work = fm.temporaryDirectory.appendingPathComponent("WallpaperUpdate-\(UUID().uuidString)")
            var zip: URL?
            if let tmp = tmp, (resp as? HTTPURLResponse)?.statusCode == 200 {
                try? fm.createDirectory(at: work, withIntermediateDirectories: true)
                let dst = work.appendingPathComponent("update.zip")
                if (try? fm.moveItem(at: tmp, to: dst)) != nil { zip = dst }
            }
            DispatchQueue.main.async { self.install(zip: zip, work: work, build: build, manual: manual) }
        }.resume()
    }

    /// Unpack the new app, swap it in place of the running one and relaunch.
    private func install(zip: URL?, work: URL, build: Int, manual: Bool) {
        updating = false
        let fm = FileManager.default
        guard let zip = zip else {
            updateStatus = "下载更新失败"
            if manual { tell(updateStatus) }
            return
        }
        let unzip = Process()
        unzip.executableURL = URL(fileURLWithPath: "/usr/bin/ditto")
        unzip.arguments = ["-x", "-k", zip.path, work.path]
        var unpacked = false
        do {
            try unzip.run()
            unzip.waitUntilExit()
            unpacked = unzip.terminationStatus == 0
        } catch {}
        let fresh = (try? fm.contentsOfDirectory(at: work, includingPropertiesForKeys: nil))?.first { $0.pathExtension == "app" }
        let current = Bundle.main.bundleURL
        let old = work.appendingPathComponent("previous.app")
        guard unpacked, let fresh = fresh else {
            updateStatus = "更新包解压失败"
            if manual { tell(updateStatus) }
            return
        }
        let target = current.deletingLastPathComponent().appendingPathComponent(fresh.lastPathComponent)
        do {
            try fm.moveItem(at: current, to: old)
            do {
                try fm.moveItem(at: fresh, to: target)
            } catch {
                try? fm.moveItem(at: old, to: current)
                throw error
            }
        } catch {
            updateStatus = "无法替换 App（没有写入「应用程序」文件夹的权限？）"
            if manual { tell(updateStatus) }
            return
        }
        let relaunch = Process()
        relaunch.executableURL = URL(fileURLWithPath: "/bin/sh")
        relaunch.arguments = ["-c", "sleep 1; /usr/bin/open \"$0\"", target.path]
        try? relaunch.run()
        NSApp.terminate(nil)
    }

    private func tell(_ message: String) {
        NSApp.activate(ignoringOtherApps: true)
        let alert = NSAlert()
        alert.messageText = "Wallpaper"
        alert.informativeText = message
        alert.runModal()
    }

    private func show() {
        surfaces.forEach { $0.close() }
        surfaces = []
        let all = scanWallpapers()
        guard let w = all.first(where: { $0.path == currentPath })
            ?? all.first(where: { $0.path == "live/vista.html" })
            ?? all.first
        else { return }
        currentPath = w.path
        surfaces = NSScreen.screens.map { Surface(screen: $0, wallpaper: w) }
        applyPause()
    }

    private func applyPause() {
        surfaces.forEach { $0.setPaused(paused || asleep) }
    }

    // Rebuilt every time the menu opens, so newly added files appear without a restart.
    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        listed = scanWallpapers()
        var lastKind: Kind?
        for (i, w) in listed.enumerated() {
            if w.kind != lastKind {
                if lastKind != nil { menu.addItem(.separator()) }
                let header = NSMenuItem(title: ["动态壁纸", "视频", "图片"][w.kind.rawValue], action: nil, keyEquivalent: "")
                header.isEnabled = false
                menu.addItem(header)
                lastKind = w.kind
            }
            let item = NSMenuItem(title: w.title, action: #selector(pick(_:)), keyEquivalent: "")
            item.target = self
            item.tag = i
            item.indentationLevel = 1
            item.state = w.path == currentPath ? .on : .off
            menu.addItem(item)
        }
        if listed.isEmpty {
            let empty = NSMenuItem(title: "文件夹里还没有壁纸", action: nil, keyEquivalent: "")
            empty.isEnabled = false
            menu.addItem(empty)
        }
        menu.addItem(.separator())
        add(to: menu, "随机换一张", #selector(shuffle))
        add(to: menu, paused ? "继续播放" : "暂停", #selector(togglePause))
        add(to: menu, "打开壁纸文件夹", #selector(openFolder))
        add(to: menu, "重新载入", #selector(reload))
        menu.addItem(.separator())
        let status = NSMenuItem(title: updateStatus, action: nil, keyEquivalent: "")
        status.isEnabled = false
        menu.addItem(status)
        add(to: menu, "检查更新", #selector(checkNow))
        add(to: menu, "自动更新", #selector(toggleAutoUpdate)).state = defaults.bool(forKey: "autoUpdate") ? .on : .off
        menu.addItem(.separator())
        add(to: menu, "开机自动启动", #selector(toggleLogin)).state = LoginItem.isEnabled ? .on : .off
        menu.addItem(.separator())
        add(to: menu, "退出 Wallpaper", #selector(quit), key: "q")
    }

    @discardableResult
    private func add(to menu: NSMenu, _ title: String, _ action: Selector, key: String = "") -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.target = self
        menu.addItem(item)
        return item
    }

    @objc private func pick(_ sender: NSMenuItem) {
        guard listed.indices.contains(sender.tag) else { return }
        currentPath = listed[sender.tag].path
        show()
    }

    @objc private func shuffle() {
        let others = scanWallpapers().filter { $0.path != currentPath }
        guard let w = others.randomElement() else { return }
        currentPath = w.path
        show()
    }

    @objc private func togglePause() {
        paused.toggle()
        defaults.set(paused, forKey: "paused")
        applyPause()
    }

    @objc private func openFolder() {
        NSWorkspace.shared.open(wallpaperDir)
    }

    @objc private func reload() {
        show()
    }

    @objc private func toggleLogin() {
        let on = !LoginItem.isEnabled
        LoginItem.set(on)
        defaults.set(on, forKey: "launchAtLogin")
    }

    @objc private func checkNow() {
        checkForUpdate(manual: true)
    }

    @objc private func toggleAutoUpdate() {
        defaults.set(!defaults.bool(forKey: "autoUpdate"), forKey: "autoUpdate")
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()
