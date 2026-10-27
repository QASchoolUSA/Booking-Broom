import SwiftUI

/// Centers content with platform inset and optional readable max width.
public struct BBPage<Content: View>: View {
    public var maxWidth: CGFloat
    public var horizontalPadding: CGFloat
    @ViewBuilder public var content: () -> Content

    @Environment(\.horizontalSizeClass) private var sizeClass

    public init(
        maxWidth: CGFloat = AppSpacing.readableContentWidth,
        horizontalPadding: CGFloat = AppSpacing.contentInset,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.maxWidth = maxWidth
        self.horizontalPadding = horizontalPadding
        self.content = content
    }

    public var body: some View {
        content()
            .frame(maxWidth: sizeClass == .regular ? maxWidth : .infinity, alignment: .leading)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.horizontal, horizontalPadding)
    }
}

/// Dashboard-style wide page (stats grids).
public struct BBWidePage<Content: View>: View {
    @ViewBuilder public var content: () -> Content
    @Environment(\.horizontalSizeClass) private var sizeClass

    public init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    public var body: some View {
        BBPage(maxWidth: AppSpacing.dashboardMaxWidth, content: content)
    }
}

/// Grouped section block with HIG-style header.
public struct BBSection<Content: View>: View {
    public let title: String?
    public var footer: String?
    @ViewBuilder public var content: () -> Content

    public init(
        _ title: String? = nil,
        footer: String? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.footer = footer
        self.content = content
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            if let title {
                Text(title)
                    .font(AppTypography.sectionTitle)
                    .foregroundStyle(.primary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityAddTraits(.isHeader)
            }
            content()
            if let footer {
                Text(footer)
                    .font(AppTypography.micro)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

/// Adaptive metric grid: 2 cols compact, 4 cols regular.
public struct BBMetricGrid<Content: View>: View {
    @Environment(\.horizontalSizeClass) private var sizeClass
    @ViewBuilder public var content: () -> Content

    public init(@ViewBuilder content: @escaping () -> Content) {
        self.content = content
    }

    private var columns: [GridItem] {
        let count = sizeClass == .regular ? 4 : 2
        return Array(repeating: GridItem(.flexible(), spacing: AppSpacing.sm), count: count)
    }

    public var body: some View {
        LazyVGrid(columns: columns, spacing: AppSpacing.sm) {
            content()
        }
    }
}
