import SwiftUI

public struct EmailThreadDetailView: View {
    public let thread: EmailThread
    @Bindable var emailVM: EmailViewModel
    public var embedsInSplit: Bool = false
    @Environment(\.dismiss) private var dismiss
    @State private var showingDeleteAlert = false
    
    public init(thread: EmailThread, emailVM: EmailViewModel, embedsInSplit: Bool = false) {
        self.thread = thread
        self.emailVM = emailVM
        self.embedsInSplit = embedsInSplit
    }
    
    public var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                LazyVStack(spacing: AppSpacing.sm) {
                    ForEach(emailVM.activeMessages) { msg in
                        EmailMessageCardView(message: msg)
                            .frame(maxWidth: embedsInSplit ? 720 : .infinity)
                            .frame(maxWidth: .infinity, alignment: msg.isOutbound ? .trailing : .leading)
                    }
                }
                .padding(AppSpacing.md)
            }
            .background(AppColors.groupedBackground)
            
            if let err = emailVM.replyError {
                Text(err)
                    .font(AppTypography.metaBold)
                    .foregroundStyle(AppColors.rose)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, AppSpacing.sm)
                    .padding(.top, AppSpacing.xs)
            }
            
            BBComposerBar(
                text: $emailVM.draftReplyText,
                placeholder: "Write a reply…",
                isSending: emailVM.isSendingReply,
                onSend: {
                    emailVM.sendReply(threadId: thread.id)
                }
            )
        }
        .navigationTitle(thread.subject.isEmpty ? "Message" : thread.subject)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(role: .destructive) {
                    showingDeleteAlert = true
                } label: {
                    Image(systemName: "trash")
                }
                .tint(AppColors.rose)
            }
        }
        .alert("Delete email thread?", isPresented: $showingDeleteAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                emailVM.deleteThread(thread)
                dismiss()
            }
        } message: {
            Text("Removes this conversation from Booking Broom and deletes it from SpaceMail.")
        }
        // One entry point for both first appearance and thread switches in the split view.
        .task(id: thread.id) {
            emailVM.openThread(thread)
        }
    }
}
