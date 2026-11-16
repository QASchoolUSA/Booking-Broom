import SwiftUI

public struct MailboxChipsView: View {
    @Bindable var emailVM: EmailViewModel
    
    public init(emailVM: EmailViewModel) {
        self.emailVM = emailVM
    }
    
    public var body: some View {
        #if os(macOS)
        macPicker
        #else
        chipStrip
        #endif
    }
    
    #if os(macOS)
    private var macPicker: some View {
        HStack(spacing: AppSpacing.sm) {
            Text("Mailbox")
                .font(AppTypography.meta)
                .foregroundStyle(.secondary)
            
            Picker("Mailbox", selection: Binding(
                get: {
                    emailVM.viewingAllMailboxes ? Optional.some("__all__") : emailVM.selectedMailbox?.id
                },
                set: { newId in
                    if newId == "__all__" {
                        emailVM.selectAllMailboxes()
                    } else if let mailbox = emailVM.mailboxes.first(where: { $0.id == newId }) {
                        emailVM.selectMailbox(mailbox)
                    }
                }
            )) {
                Text(allLabel).tag(Optional.some("__all__"))
                ForEach(emailVM.mailboxes) { mailbox in
                    Text(mailboxLabel(mailbox)).tag(Optional.some(mailbox.id))
                }
            }
            .pickerStyle(.menu)
            .labelsHidden()
            .frame(maxWidth: 280)
            
            Spacer()
        }
        .padding(.horizontal, AppSpacing.contentInset)
        .padding(.vertical, AppSpacing.xs)
    }
    
    private var allLabel: String {
        if emailVM.totalUnreadCount > 0 {
            return "All (\(emailVM.totalUnreadCount))"
        }
        return "All"
    }
    
    private func mailboxLabel(_ mailbox: EmailMailbox) -> String {
        if mailbox.unreadCount > 0 {
            return "\(mailbox.displayName) (\(mailbox.unreadCount))"
        }
        return mailbox.displayName
    }
    #endif
    
    #if os(iOS)
    private var chipStrip: some View {
        HorizontalChipScrollView {
            HStack(spacing: 10) {
                allChip
                ForEach(emailVM.mailboxes) { mailbox in
                    let isSelected = !emailVM.viewingAllMailboxes && emailVM.selectedMailbox?.id == mailbox.id
                    Button {
                        emailVM.selectMailbox(mailbox)
                    } label: {
                        chipLabel(
                            title: mailbox.displayName,
                            unread: mailbox.unreadCount,
                            isSelected: isSelected
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, AppSpacing.md)
        }
        .horizontalChipStrip(height: 44)
    }

    private var allChip: some View {
        Button {
            emailVM.selectAllMailboxes()
        } label: {
            chipLabel(
                title: "All",
                unread: emailVM.totalUnreadCount,
                isSelected: emailVM.viewingAllMailboxes
            )
        }
        .buttonStyle(.plain)
    }

    private func chipLabel(title: String, unread: Int, isSelected: Bool) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "envelope.fill")
                .font(.caption2)
            
            Text(title)
                .font(AppTypography.metaBold)
                .lineLimit(1)
            
            if unread > 0 {
                Text("\(unread)")
                    .font(AppTypography.microBold)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(isSelected ? Color.white.opacity(0.95) : AppColors.primary)
                    .foregroundStyle(isSelected ? AppColors.primary : .white)
                    .clipShape(Capsule())
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background {
            if isSelected {
                Capsule()
                    .fill(AppColors.primary)
            } else {
                Capsule()
                    .fill(.regularMaterial)
            }
        }
        .foregroundStyle(isSelected ? .white : .primary)
        .overlay(
            Capsule()
                .stroke(isSelected ? Color.clear : Color.primary.opacity(0.08), lineWidth: 1)
        )
    }
    #endif
}
