import SwiftUI

#if os(iOS)
import SafariServices

/// In-app Safari browser sheet (SFSafariViewController).
public struct SafariView: UIViewControllerRepresentable {
    public let url: URL
    
    public init(url: URL) {
        self.url = url
    }
    
    public func makeUIViewController(context: Context) -> SFSafariViewController {
        let config = SFSafariViewController.Configuration()
        config.entersReaderIfAvailable = false
        let controller = SFSafariViewController(url: url, configuration: config)
        controller.preferredControlTintColor = UIColor(AppColors.primary)
        return controller
    }
    
    public func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}
#endif

#if os(macOS)
import AppKit

/// Opens links in the default browser on Mac (Safari / user preference).
public struct SafariView: View {
    public let url: URL
    
    public init(url: URL) {
        self.url = url
    }
    
    public var body: some View {
        Color.clear
            .frame(width: 1, height: 1)
            .onAppear {
                NSWorkspace.shared.open(url)
            }
    }
}

public enum PlatformOpenURL {
    public static func open(_ url: URL) {
        NSWorkspace.shared.open(url)
    }
}
#endif

#if os(iOS)
public enum PlatformOpenURL {
    public static func open(_ url: URL) {
        UIApplication.shared.open(url)
    }
}
#endif
