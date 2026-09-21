import SwiftUI

public struct EmailInboxView: View {
    @Bindable var emailVM: EmailViewModel
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var selectedThreadId: String?
    
    public init(emailVM: EmailViewModel) {
        self.emailVM = emailVM
    }
    
    private var selectedThread: EmailThread? {
        guard let selectedThreadId else { return nil }
        return emailVM.filteredThreads.first { $0.id == selectedThreadId }
    }
    
    public var body: some View {
        NavigationStack {
            Group {
                #if os(macOS)
                iPadMailLayout
                #else
                if sizeClass == .regular {
                    iPadMailLayout
                } else {
                    phoneMailLayout
                }
                #endif
            }
            .background(AppColors.groupedBackground.ignoresSafeArea())
            .navigationTitle("Mail")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        emailVM.syncCurrentMailbox()
                    } label: {
                        if emailVM.isSyncing {
                            ProgressView()
                        } else {
                            Label("Sync", systemImage: "arrow.clockwise")
                        }
                    }
                }
            }
            #endif
            .searchable(text: $emailVM.searchText, prompt: "Search mail")
            .refreshable {
                // Pull-to-refresh reloads from Convex only; IMAP sync stays on the toolbar button / ⌘R.
                await emailVM.refreshCurrentMailboxAndWait()
            }
            .onAppear {
                emailVM.ensureLoaded()
            }
        }
    }
    
    private var phoneMailLayout: some View {
        Group {
            if emailVM.filteredThreads.isEmpty {
                emptyState
            } else {
                threadList(pushDetail: true)
            }
        }
        .safeAreaInset(edge: .top, spacing: 0) {
            mailboxChipBar
        }
    }
    
    private var iPadMailLayout: some View {
        HStack(spacing: 0) {
            Group {
                if emailVM.filteredThreads.isEmpty {
                    emptyState
                } else {
                    threadList(pushDetail: false)
                }
            }
            .frame(minWidth: 320, idealWidth: 380, maxWidth: 420)
            .safeAreaInset(edge: .top, spacing: 0) {
                mailboxChipBar
            }
            
            Divider()
            
            if let thread = selectedThread {
                EmailThreadDetailView(thread: thread, emailVM: emailVM, embedsInSplit: true)
            } else {
                ContentUnavailableView(
                    "No Conversation Selected",
                    systemImage: "envelope.open",
                    description: Text("Pick a thread to read and reply.")
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
    
    private var mailboxChipBar: some View {
        MailboxChipsView(emailVM: emailVM)
            .padding(.vertical, 4)
            .frame(maxWidth: .infinity)
            .background(.bar)
    }
    
    private func threadList(pushDetail: Bool) -> some View {
        List {
            ForEach(emailVM.filteredThreads) { thread in
                Group {
                    if pushDetail {
                        NavigationLink {
                            EmailThreadDetailView(thread: thread, emailVM: emailVM)
                        } label: {
                            EmailThreadRow(thread: thread)
                        }
                    } else {
                        Button {
                            selectedThreadId = thread.id
                        } label: {
                            EmailThreadRow(thread: thread, isSelected: thread.id == selectedThreadId)
                        }
                        .buttonStyle(.plain)
                        .listRowBackground(
                            thread.id == selectedThreadId
                                ? AppColors.primary.opacity(0.10)
                                : Color.clear
                        )
                    }
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                    Button(role: .destructive) {
                        if selectedThreadId == thread.id { selectedThreadId = nil }
                        emailVM.deleteThread(thread)
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }
    
    private var emptyState: some View {
        VStack(spacing: AppSpacing.sm) {
            Spacer()
            Image(systemName: emailVM.searchText.isEmpty ? "tray" : "magnifyingglass")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(AppColors.primary.opacity(0.7))
            Text(emailVM.searchText.isEmpty ? "No conversations" : "No matches")
                .font(AppTypography.pageTitle)
            Text(
                emailVM.searchText.isEmpty
                    ? "Synced SpaceMail threads for this mailbox will appear here."
                    : "Try a different search term."
            )
            .font(AppTypography.meta)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .padding(.horizontal, AppSpacing.xl)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

private struct EmailThreadRow: View {
    let thread: EmailThread
    var isSelected: Bool = false
    
    var body: some View {
        HStack(alignment: .top, spacing: AppSpacing.sm) {
            ContactAvatar(
                title: thread.participants.first ?? "E",
                tint: thread.unreadCount > 0 ? AppColors.primary : .secondary,
                size: 40
            )
            
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline) {
                    Text(thread.participants.first ?? "Customer")
                        .font(thread.unreadCount > 0 ? AppTypography.rowTitle : AppTypography.metaBold)
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    Text(relativeDate(thread.lastMessageAt))
                        .font(AppTypography.meta)
                        .foregroundStyle(.secondary)
                }
                
                HStack(spacing: 6) {
                    Text(thread.subject.isEmpty ? "(No Subject)" : thread.subject)
                        .font(thread.unreadCount > 0 ? AppTypography.rowTitle : AppTypography.meta)
                        .foregroundStyle(.primary)
                        .lineLimit(1)
                    if thread.unreadCount > 0 {
                        Text("\(thread.unreadCount)")
                            .font(AppTypography.microBold)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(AppColors.primary)
                            .foregroundStyle(.white)
                            .clipShape(Capsule())
                    }
                }
                
                Text(thread.lastSnippet)
                    .font(AppTypography.meta)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                
                if let site = thread.siteName, !site.isEmpty {
                    Text(site)
                        .font(AppTypography.microBold)
                        .foregroundStyle(AppColors.sky)
                }
            }
        }
        .padding(.vertical, 4)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
    
    private func relativeDate(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return date.formatted(date: .omitted, time: .shortened)
        }
        if calendar.isDateInYesterday(date) {
            return "Yesterday"
        }
        return date.formatted(date: .abbreviated, time: .omitted)
    }
}
