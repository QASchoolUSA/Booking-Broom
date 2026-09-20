import SwiftUI

public struct StatusPill: View {
    public let status: BookingStatus
    
    public init(status: BookingStatus) {
        self.status = status
    }
    
    private var horizontalPadding: CGFloat {
        #if os(macOS)
        8
        #else
        10
        #endif
    }
    
    private var verticalPadding: CGFloat {
        #if os(macOS)
        3
        #else
        5
        #endif
    }
    
    public var body: some View {
        HStack(spacing: 4) {
            Image(systemName: status.iconName)
                .font(AppTypography.microBold)
            Text(status.displayName)
                .font(AppTypography.metaBold)
        }
        .padding(.horizontal, horizontalPadding)
        .padding(.vertical, verticalPadding)
        .background(AppColors.backgroundColor(forStatus: status.rawValue))
        .foregroundStyle(AppColors.color(forStatus: status.rawValue))
        .clipShape(Capsule())
        #if os(iOS)
        .overlay(
            Capsule()
                .stroke(AppColors.color(forStatus: status.rawValue).opacity(0.3), lineWidth: 0.5)
        )
        #endif
    }
}
