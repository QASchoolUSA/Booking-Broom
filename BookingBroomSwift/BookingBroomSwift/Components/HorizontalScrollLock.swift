import SwiftUI

#if os(iOS)
import UIKit

extension View {
    /// Fixed-height clip for chip strips that already use `HorizontalChipScrollView`.
    func horizontalChipStrip(height: CGFloat = 44) -> some View {
        self
            .frame(height: height)
            .clipped()
    }
}

/// Horizontal-only chip strip (SEO-like behavior for sticky headers).
public struct HorizontalChipScrollView<Content: View>: UIViewRepresentable {
    private let content: Content
    
    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    public func makeCoordinator() -> Coordinator {
        Coordinator(content: content)
    }
    
    public func makeUIView(context: Context) -> AxisLockedScrollView {
        let scroll = AxisLockedScrollView()
        scroll.showsHorizontalScrollIndicator = false
        scroll.showsVerticalScrollIndicator = false
        scroll.alwaysBounceVertical = false
        scroll.alwaysBounceHorizontal = true
        scroll.isDirectionalLockEnabled = true
        scroll.bounces = true
        scroll.backgroundColor = .clear
        scroll.clipsToBounds = true
        if #available(iOS 17.4, *) {
            scroll.bouncesVertically = false
        }
        
        let host = context.coordinator.hostingController
        host.view.backgroundColor = .clear
        host.view.translatesAutoresizingMaskIntoConstraints = false
        if #available(iOS 16.0, *) {
            host.sizingOptions = .intrinsicContentSize
        }
        if #available(iOS 16.4, *) {
            host.safeAreaRegions = []
        }
        
        scroll.addSubview(host.view)
        
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: scroll.contentLayoutGuide.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: scroll.contentLayoutGuide.trailingAnchor),
            host.view.topAnchor.constraint(equalTo: scroll.contentLayoutGuide.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: scroll.contentLayoutGuide.bottomAnchor),
            host.view.heightAnchor.constraint(equalTo: scroll.frameLayoutGuide.heightAnchor),
        ])
        
        return scroll
    }
    
    public func updateUIView(_ scrollView: AxisLockedScrollView, context: Context) {
        let host = context.coordinator.hostingController
        host.rootView = content
        
        let height = max(scrollView.bounds.height, 1)
        let fittingWidth = host.sizeThatFits(in: CGSize(
            width: UIView.layoutFittingExpandedSize.width,
            height: height
        )).width
        
        if abs(fittingWidth - context.coordinator.lastFittingWidth) < 0.5,
           abs(height - context.coordinator.lastHeight) < 0.5 {
            return
        }
        
        context.coordinator.lastFittingWidth = fittingWidth
        context.coordinator.lastHeight = height
        
        if fittingWidth > 0 {
            scrollView.contentSize = CGSize(width: fittingWidth, height: height)
        }
    }
    
    public final class Coordinator {
        let hostingController: UIHostingController<Content>
        var lastFittingWidth: CGFloat = -1
        var lastHeight: CGFloat = -1
        
        init(content: Content) {
            hostingController = UIHostingController(rootView: content)
        }
    }
}

public final class AxisLockedScrollView: UIScrollView {
    public override func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        if let pan = gestureRecognizer as? UIPanGestureRecognizer, pan === panGestureRecognizer {
            let velocity = pan.velocity(in: self)
            if abs(velocity.y) > abs(velocity.x) {
                return false
            }
        }
        return super.gestureRecognizerShouldBegin(gestureRecognizer)
    }
    
    public override func touchesShouldCancel(in view: UIView) -> Bool {
        true
    }
}
#endif

#if os(macOS)
extension View {
    func horizontalChipStrip(height: CGFloat = 44) -> some View {
        self
            .frame(height: height)
            .clipped()
    }
}

/// On Mac, a plain horizontal ScrollView is enough (trackpad / mouse).
public struct HorizontalChipScrollView<Content: View>: View {
    private let content: Content
    
    public init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    public var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            content
        }
    }
}
#endif
