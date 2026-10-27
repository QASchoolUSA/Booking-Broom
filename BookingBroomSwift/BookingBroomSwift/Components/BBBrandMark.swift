import SwiftUI

/// In-app brand mark (separate from AppIcon). Clipped to a continuous rounded rect.
public struct BBBrandMark: View {
    public enum Size {
        case login
        case settings

        var side: CGFloat {
            switch self {
            case .login: return 80
            case .settings: return 44
            }
        }
    }

    private let size: Size
    private let isDecorative: Bool

    public init(_ size: Size, decorative: Bool = false) {
        self.size = size
        self.isDecorative = decorative
    }

    public var body: some View {
        Image("BrandMark")
            .resizable()
            .aspectRatio(1, contentMode: .fit)
            .frame(width: size.side, height: size.side)
            .clipShape(RoundedRectangle(cornerRadius: size.side * 0.223, style: .continuous))
            .accessibilityLabel("Booking Broom")
            .accessibilityHidden(isDecorative)
    }
}
