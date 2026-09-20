import SwiftUI

/// Circular contact / thread avatar with consistent brand tint.
public struct ContactAvatar: View {
    public let title: String
    public var systemImage: String = "person.fill"
    public var tint: Color = AppColors.primary
    public var size: CGFloat = 40
    
    public init(
        title: String,
        systemImage: String = "person.fill",
        tint: Color = AppColors.primary,
        size: CGFloat = 40
    ) {
        self.title = title
        self.systemImage = systemImage
        self.tint = tint
        self.size = size
    }
    
    private var initials: String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }
        let parts = trimmed.split(separator: " ").prefix(2)
        let chars = parts.compactMap { $0.first.map(String.init) }
        if chars.count >= 1 {
            return chars.joined().uppercased()
        }
        return String(trimmed.prefix(1)).uppercased()
    }
    
    public var body: some View {
        ZStack {
            Circle()
                .fill(tint.opacity(0.14))
                .frame(width: size, height: size)
            
            if initials.isEmpty {
                Image(systemName: systemImage)
                    .font(.system(size: size * 0.38, weight: .semibold))
                    .foregroundStyle(tint)
            } else {
                Text(initials)
                    .font(.system(size: size * 0.34, weight: .semibold))
                    .foregroundStyle(tint)
            }
        }
        .accessibilityHidden(true)
    }
}

/// Quiet section header for dashboard / ops lists.
public struct SectionHeader: View {
    public let title: String
    public var actionTitle: String? = nil
    public var action: (() -> Void)? = nil
    
    public init(title: String, actionTitle: String? = nil, action: (() -> Void)? = nil) {
        self.title = title
        self.actionTitle = actionTitle
        self.action = action
    }
    
    public var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(AppTypography.sectionTitle)
                .foregroundStyle(.primary)
            Spacer(minLength: AppSpacing.sm)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .font(AppTypography.metaBold)
                    .buttonStyle(.plain)
                    .foregroundStyle(AppColors.primary)
            }
        }
    }
}

/// Mac menu filter for optional string IDs (sites, mailboxes).
public struct StringFilterMenu: View {
    public let title: String
    public let options: [(id: String, label: String)]
    @Binding public var selection: String?
    
    public init(title: String, options: [(id: String, label: String)], selection: Binding<String?>) {
        self.title = title
        self.options = options
        self._selection = selection
    }
    
    public var body: some View {
        Picker(title, selection: $selection) {
            Text("All").tag(Optional<String>.none)
            ForEach(options, id: \.id) { option in
                Text(option.label).tag(Optional.some(option.id))
            }
        }
        .pickerStyle(.menu)
        .labelsHidden()
        .frame(maxWidth: 200)
        .accessibilityLabel(title)
    }
}

/// Mac menu filter for optional booking status.
public struct StatusFilterMenu: View {
    @Binding public var selection: BookingStatus?
    
    public init(selection: Binding<BookingStatus?>) {
        self._selection = selection
    }
    
    public var body: some View {
        Picker("Status", selection: $selection) {
            Text("All Status").tag(Optional<BookingStatus>.none)
            ForEach(BookingStatus.allCases) { status in
                Text(status.displayName).tag(Optional.some(status))
            }
        }
        .pickerStyle(.menu)
        .labelsHidden()
        .frame(maxWidth: 160)
        .accessibilityLabel("Status")
    }
}
