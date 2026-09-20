import SwiftUI

public struct MailboxChipsView: View {
    @ObservedObject var emailVM: EmailViewModel
    
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
                get: { emailVM.selectedMailbox?.id },
                set: { newId in
                    if let mailbox = emailVM.mailboxes.first(where: { $0.id == newId }) {
                        emailVM.selectMailbox(mailbox)
                    }
                }
            )) {
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
                ForEach(emailVM.mailboxes) { mailbox in
                    let isSelected = emailVM.selectedMailbox?.id == mailbox.id
                    Button {
                        emailVM.selectMailbox(mailbox)
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "envelope.fill")
                                .font(.caption2)
                            
                            Text(mailbox.displayName)
                                .font(AppTypography.metaBold)
                                .lineLimit(1)
                            
                            if mailbox.unreadCount > 0 {
                                Text("\(mailbox.unreadCount)")
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
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, AppSpacing.md)
        }
        .horizontalChipStrip(height: 44)
    }
    #endif
}
