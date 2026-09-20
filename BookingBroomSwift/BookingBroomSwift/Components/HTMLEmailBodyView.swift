import SwiftUI
import WebKit

/// Renders an HTML email body in a self-sizing WKWebView (Mail.app-style).
public struct HTMLEmailBodyView: View {
    public let html: String
    
    @State private var contentHeight: CGFloat = 120
    @State private var linkURL: URL?
    
    public init(html: String) {
        self.html = html
    }
    
    public var body: some View {
        HTMLEmailWebView(
            html: html,
            contentHeight: $contentHeight,
            onOpenURL: { url in
                #if os(macOS)
                PlatformOpenURL.open(url)
                #else
                linkURL = url
                #endif
            }
        )
        .frame(height: max(contentHeight, 40))
        .frame(maxWidth: .infinity)
        #if os(iOS)
        .sheet(item: Binding(
            get: { linkURL.map(IdentifiableURL.init) },
            set: { linkURL = $0?.url }
        )) { item in
            SafariView(url: item.url)
                .ignoresSafeArea()
        }
        #endif
    }
}

private struct IdentifiableURL: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}

private enum HTMLEmailDocument {
    static func wrappedHTML(_ body: String) -> String {
        let inject = """
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
        <style>
          :root { color-scheme: light dark; }
          html, body {
            margin: 0;
            padding: 0;
            background: transparent !important;
            word-wrap: break-word;
            overflow-wrap: anywhere;
            -webkit-text-size-adjust: 100%;
          }
          img, table, td { max-width: 100% !important; height: auto !important; }
        </style>
        """
        
        let trimmed = body.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = trimmed.lowercased()
        if lower.contains("<html") {
            if let range = trimmed.range(of: "<head", options: .caseInsensitive),
               let close = trimmed[range.lowerBound...].range(of: ">", options: .literal) {
                var result = trimmed
                result.insert(contentsOf: inject, at: close.upperBound)
                return result
            }
            if let range = trimmed.range(of: "<html", options: .caseInsensitive),
               let close = trimmed[range.lowerBound...].range(of: ">", options: .literal) {
                var result = trimmed
                result.insert(contentsOf: "<head>\(inject)</head>", at: close.upperBound)
                return result
            }
            return trimmed
        }
        
        return """
        <!DOCTYPE html>
        <html>
        <head>
        <meta charset="utf-8">
        \(inject)
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 16px;
            line-height: 1.45;
            color: CanvasText;
          }
          a { color: #2563eb; }
        </style>
        </head>
        <body>\(body)</body>
        </html>
        """
    }
}

final class HTMLEmailCoordinator: NSObject, WKNavigationDelegate {
    var contentHeight: Binding<CGFloat>
    var onOpenURL: (URL) -> Void
    var lastLoadedHTML: String?
    #if os(iOS)
    private var observation: NSKeyValueObservation?
    #endif
    private var heightWorkItem: DispatchWorkItem?
    
    init(contentHeight: Binding<CGFloat>, onOpenURL: @escaping (URL) -> Void) {
        self.contentHeight = contentHeight
        self.onOpenURL = onOpenURL
    }
    
    #if os(iOS)
    func observeContentSize(of webView: WKWebView) {
        observation = webView.scrollView.observe(\.contentSize, options: [.new]) { [weak self] scrollView, _ in
            let height = scrollView.contentSize.height
            guard height > 0 else { return }
            self?.scheduleHeightUpdate(height)
        }
    }
    #endif
    
    private func scheduleHeightUpdate(_ height: CGFloat) {
        heightWorkItem?.cancel()
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            if abs(self.contentHeight.wrappedValue - height) > 2 {
                self.contentHeight.wrappedValue = height
            }
        }
        heightWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.08, execute: work)
    }
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        #if os(iOS)
        webView.setNeedsLayout()
        webView.layoutIfNeeded()
        let height = webView.scrollView.contentSize.height
        if height > 0 {
            scheduleHeightUpdate(height)
        }
        #else
        webView.evaluateJavaScript(
            "Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)"
        ) { [weak self] result, _ in
            if let height = result as? CGFloat, height > 0 {
                self?.scheduleHeightUpdate(height)
            } else if let number = result as? NSNumber {
                self?.scheduleHeightUpdate(CGFloat(truncating: number))
            }
        }
        #endif
    }
    
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        
        if navigationAction.navigationType == .linkActivated {
            if url.scheme == "http" || url.scheme == "https" {
                onOpenURL(url)
            }
            decisionHandler(.cancel)
            return
        }
        
        if url.scheme == "about" || navigationAction.targetFrame?.isMainFrame == true {
            decisionHandler(.allow)
            return
        }
        
        decisionHandler(.allow)
    }
    
    deinit {
        heightWorkItem?.cancel()
        #if os(iOS)
        observation?.invalidate()
        #endif
    }
}

#if os(iOS)
private struct HTMLEmailWebView: UIViewRepresentable {
    let html: String
    @Binding var contentHeight: CGFloat
    let onOpenURL: (URL) -> Void
    
    func makeCoordinator() -> HTMLEmailCoordinator {
        HTMLEmailCoordinator(contentHeight: $contentHeight, onOpenURL: onOpenURL)
    }
    
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = false
        config.suppressesIncrementalRendering = true
        
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        
        context.coordinator.observeContentSize(of: webView)
        return webView
    }
    
    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.onOpenURL = onOpenURL
        context.coordinator.contentHeight = $contentHeight
        
        let wrapped = HTMLEmailDocument.wrappedHTML(html)
        if context.coordinator.lastLoadedHTML != wrapped {
            context.coordinator.lastLoadedHTML = wrapped
            webView.loadHTMLString(wrapped, baseURL: nil)
        }
    }
}
#endif

#if os(macOS)
private struct HTMLEmailWebView: NSViewRepresentable {
    let html: String
    @Binding var contentHeight: CGFloat
    let onOpenURL: (URL) -> Void
    
    func makeCoordinator() -> HTMLEmailCoordinator {
        HTMLEmailCoordinator(contentHeight: $contentHeight, onOpenURL: onOpenURL)
    }
    
    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = false
        config.suppressesIncrementalRendering = true
        
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.setValue(false, forKey: "drawsBackground")
        return webView
    }
    
    func updateNSView(_ webView: WKWebView, context: Context) {
        context.coordinator.onOpenURL = onOpenURL
        context.coordinator.contentHeight = $contentHeight
        
        let wrapped = HTMLEmailDocument.wrappedHTML(html)
        if context.coordinator.lastLoadedHTML != wrapped {
            context.coordinator.lastLoadedHTML = wrapped
            webView.loadHTMLString(wrapped, baseURL: nil)
        }
    }
}
#endif
