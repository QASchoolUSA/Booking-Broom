import SwiftUI

public struct SettingsView: View {
    @ObservedObject var settingsVM: SettingsViewModel
    @ObservedObject var authVM: AuthViewModel
    @ObservedObject var opsVM: OpsViewModel
    
    public init(
        settingsVM: SettingsViewModel,
        authVM: AuthViewModel,
        opsVM: OpsViewModel
    ) {
        self.settingsVM = settingsVM
        self.authVM = authVM
        self.opsVM = opsVM
    }
    
    public var body: some View {
        Form {
            Section("Manager Profile") {
                HStack(spacing: 12) {
                    ZStack {
                        Circle()
                            .fill(
                                LinearGradient(
                                    colors: [AppColors.primaryGradientStart, AppColors.primaryGradientEnd],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .frame(width: 52, height: 52)
                        Text(initials)
                            .font(.headline.bold())
                            .foregroundStyle(.white)
                    }
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(authVM.session.managerName ?? "Manager")
                            .font(.headline)
                        Text(authVM.session.email ?? "—")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }
            
            Section("Security & Notifications") {
                Toggle(
                    "\(authVM.biometryName) Unlock",
                    isOn: Binding(
                        get: { authVM.isBiometricsEnabled },
                        set: { newValue in
                            Task {
                                let ok = await authVM.setBiometricsEnabled(newValue)
                                if !ok && newValue {
                                    HapticFeedback.notification(.error)
                                }
                            }
                        }
                    )
                )
                .disabled(!BiometricAuthManager.shared.hasBiometricHardware)
                
                Toggle(
                    "Push Notifications",
                    isOn: Binding(
                        get: { settingsVM.isPushEnabled },
                        set: { newValue in
                            Task {
                                await settingsVM.setPushEnabled(newValue)
                            }
                        }
                    )
                )
                .disabled(settingsVM.isPushBusy)
                
                if let pushError = settingsVM.pushError {
                    Text(pushError)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
            
            Section("Sites & Pricing") {
                NavigationLink {
                    PricingOpsView(opsVM: opsVM)
                } label: {
                    Label("Live Pricing", systemImage: "dollarsign.circle.fill")
                }
            }
            
            Section("Backend Connection") {
                Toggle("Demo / Offline Mock Data Mode", isOn: $settingsVM.apiModeIsMock)
                    .onChange(of: settingsVM.apiModeIsMock) { _, newValue in
                        ConvexAPIService.shared.useMockData = newValue
                    }
                
                HStack {
                    Text("Convex URL")
                    Spacer()
                    TextField("http://127.0.0.1:3210", text: $settingsVM.convexURL)
                        .textFieldStyle(.roundedBorder)
                        .multilineTextAlignment(.trailing)
                        .font(AppTypography.meta)
                        .frame(maxWidth: 280)
                }
            }
            
            Section("Managed Cleaning Sites (\(settingsVM.sites.count))") {
                ForEach(settingsVM.sites) { site in
                    HStack {
                        Circle()
                            .fill(site.accentColor)
                            .frame(width: 12, height: 12)
                        Text(site.name)
                            .font(.subheadline.weight(.medium))
                        Spacer()
                        Text(site.domain)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            
            Section {
                Button(role: .destructive, action: { authVM.logout() }) {
                    Text("Sign Out")
                        .frame(maxWidth: .infinity)
                }
                .bbDestructiveButton(expand: true)
            }
        }
        .navigationTitle("Settings")
        .onAppear {
            settingsVM.ensureLoaded()
        }
    }
    
    private var initials: String {
        let name = authVM.session.managerName ?? "M"
        let parts = name.split(separator: " ")
        if parts.count >= 2 {
            return String(parts[0].prefix(1) + parts[1].prefix(1)).uppercased()
        }
        return String(name.prefix(2)).uppercased()
    }
}
