import SwiftUI

public struct AIWandModal: View {
    @ObservedObject var messagesVM: MessagesViewModel
    public let siteName: String
    @Environment(\.dismiss) private var dismiss
    @FocusState private var editorFocused: Bool
    
    public init(messagesVM: MessagesViewModel, siteName: String) {
        self.messagesVM = messagesVM
        self.siteName = siteName
    }
    
    public var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: AppSpacing.lg) {
                HStack(spacing: AppSpacing.sm) {
                    Image(systemName: "wand.and.stars")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(AppColors.violet)
                        .frame(width: 40, height: 40)
                        .background(AppColors.violet.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: ControlMetrics.controlRadius, style: .continuous))
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("AI SMS Polisher")
                            .font(AppTypography.pageTitle)
                        Text("Rewrite drafts for \(siteName)")
                            .font(AppTypography.meta)
                            .foregroundStyle(.secondary)
                    }
                }
                
                VStack(alignment: .leading, spacing: AppSpacing.xxs + 2) {
                    Text("Draft Message")
                        .font(AppTypography.metaBold)
                        .foregroundStyle(.secondary)
                    
                    TextEditor(text: $messagesVM.draftText)
                        .focused($editorFocused)
                        .font(AppTypography.body)
                        .frame(minHeight: 120, maxHeight: 200)
                        .bbEditorChrome(isFocused: editorFocused)
                }
                
                Button {
                    messagesVM.polishDraft(siteName: siteName)
                } label: {
                    HStack(spacing: AppSpacing.xs) {
                        if messagesVM.isPolishingWithAI {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Image(systemName: "sparkles")
                        }
                        Text("Rewrite Professionally")
                    }
                    .frame(maxWidth: .infinity)
                }
                .bbPrimaryButton(isLoading: messagesVM.isPolishingWithAI, expand: true)
                .disabled(messagesVM.isPolishingWithAI || messagesVM.draftText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                
                Spacer(minLength: 0)
            }
            .padding(AppSpacing.lg)
            .navigationTitle("AI Assistant")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 420, minHeight: 360)
        #endif
    }
}
