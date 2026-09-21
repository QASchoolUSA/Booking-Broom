import SwiftUI

public struct LoginView: View {
    @Bindable var authVM: AuthViewModel
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @FocusState private var focusedField: Field?
    @State private var appeared = false
    
    private enum Field {
        case email, password
    }
    
    public init(authVM: AuthViewModel) {
        self.authVM = authVM
    }
    
    public var body: some View {
        ZStack {
            AppColors.groupedBackground
                .ignoresSafeArea()
            
            GeometryReader { geo in
                ScrollView {
                    VStack(spacing: 0) {
                        Spacer(minLength: sizeClass == .regular ? max(AppSpacing.xxl + AppSpacing.md, geo.size.height * 0.10) : AppSpacing.xxl)
                        
                        brandHeader
                            .padding(.bottom, AppSpacing.xl)
                            .opacity(appeared ? 1 : 0)
                            .offset(y: appeared && !reduceMotion ? 0 : 10)
                        
                        Group {
                            if authVM.canUseBiometrics && !authVM.prefersPasswordForm {
                                biometricUnlockPanel
                            } else {
                                passwordPanel
                            }
                        }
                        .frame(maxWidth: sizeClass == .regular ? 440 : .infinity)
                        .padding(.horizontal, sizeClass == .regular ? 0 : AppSpacing.lg)
                        .opacity(appeared ? 1 : 0)
                        .offset(y: appeared && !reduceMotion ? 0 : 16)
                        
                        Spacer(minLength: 40)
                        
                        #if DEBUG
                        Text(authVM.convexBaseURL)
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(.tertiary)
                            .padding(.bottom, 6)
                        #endif
                        
                        Text("Booking Broom Manager")
                            .font(AppTypography.microBold)
                            .foregroundStyle(.tertiary)
                            .padding(.bottom, AppSpacing.xl)
                    }
                    .frame(maxWidth: .infinity, minHeight: geo.size.height)
                }
                .platformScrollDismissesKeyboard()
            }
        }
        .tint(AppColors.primary)
        .onAppear {
            let showBiometricUnlock = authVM.canUseBiometrics && !authVM.prefersPasswordForm
            if showBiometricUnlock || reduceMotion {
                // Unlock chrome must be visible immediately — do not fade from opacity 0
                // while Face ID could otherwise race past the login screen.
                appeared = true
            } else {
                withAnimation(.easeOut(duration: 0.45)) { appeared = true }
            }
            // Require an explicit tap on "Unlock with Face ID" so the login page is visible.
        }
    }
    
    private var brandHeader: some View {
        VStack(spacing: AppSpacing.sm) {
            ZStack {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(AppColors.primary)
                    .frame(width: 64, height: 64)
                
                Image(systemName: "broom.fill")
                    .font(.system(size: 28, weight: .semibold))
                    .foregroundStyle(.white)
            }
            
            Text("Booking Broom")
                .font(.system(size: 30, weight: .bold, design: .rounded))
                .foregroundStyle(.primary)
            
            Text("Manager control for every cleaning site")
                .font(AppTypography.meta)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, AppSpacing.xl)
        }
    }
    
    private var biometricUnlockPanel: some View {
        VStack(spacing: AppSpacing.lg) {
            if let email = KeychainStore.string(forKey: KeychainStore.Key.email)
                ?? optionalNonEmpty(authVM.emailInput) {
                Text(email)
                    .font(AppTypography.rowTitle)
                    .foregroundStyle(.secondary)
            }
            
            Button {
                authVM.unlockWithBiometrics()
            } label: {
                VStack(spacing: AppSpacing.sm) {
                    if authVM.isUnlockingBiometrics {
                        ProgressView()
                            .scaleEffect(1.1)
                            .frame(height: 48)
                    } else {
                        Image(systemName: authVM.biometrySymbol)
                            .font(.system(size: 44, weight: .regular))
                            .foregroundStyle(AppColors.primary)
                            .frame(height: 48)
                            .symbolRenderingMode(.hierarchical)
                    }
                    
                    Text("Unlock with \(authVM.biometryName)")
                        .font(AppTypography.sectionTitle)
                        .foregroundStyle(.primary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, AppSpacing.xl)
            }
            .buttonStyle(.plain)
            .disabled(authVM.isUnlockingBiometrics)
            
            if let err = authVM.errorMessage {
                errorBanner(err)
            }
            
            Button("Use Password") {
                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.22)) {
                    authVM.prefersPasswordForm = true
                    authVM.errorMessage = nil
                }
            }
            .bbSecondaryButton(expand: true)
        }
        .padding(AppSpacing.xl)
        .appSurface(cornerRadius: 16)
    }
    
    private var passwordPanel: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            VStack(alignment: .leading, spacing: AppSpacing.xxs) {
                Text(authVM.isSignUpMode ? "Create manager account" : "Sign in")
                    .font(AppTypography.pageTitle)
                Text(
                    authVM.isSignUpMode
                        ? "First time only — use a strong password."
                        : "Use your Booking Broom manager credentials."
                )
                .font(AppTypography.meta)
                .foregroundStyle(.secondary)
            }
            
            BBFieldChrome(
                title: "Email",
                symbol: "envelope.fill",
                isFocused: focusedField == .email
            ) {
                TextField("you@company.com", text: $authVM.emailInput)
                    .textContentType(.username)
                    .platformKeyboardType(.emailAddress)
                    #if os(iOS)
                    .textInputAutocapitalization(.never)
                    #endif
                    .autocorrectionDisabled()
                    .focused($focusedField, equals: .email)
                    .submitLabel(.next)
                    .onSubmit { focusedField = .password }
            }
            
            BBFieldChrome(
                title: "Password",
                symbol: "lock.fill",
                isFocused: focusedField == .password
            ) {
                SecureField("Password", text: $authVM.passwordInput)
                    .textContentType(authVM.isSignUpMode ? .newPassword : .password)
                    .focused($focusedField, equals: .password)
                    .submitLabel(.go)
                    .onSubmit { authVM.submit() }
            }
            
            if let err = authVM.errorMessage {
                errorBanner(err)
            }
            
            Button {
                authVM.submit()
            } label: {
                HStack(spacing: AppSpacing.xs) {
                    if authVM.isLoading {
                        ProgressView()
                            .controlSize(.small)
                    }
                    Text(authVM.isSignUpMode ? "Create Account" : "Sign In")
                }
                .frame(maxWidth: .infinity)
            }
            .bbPrimaryButton(isLoading: authVM.isLoading, expand: true)
            .disabled(authVM.isLoading || !canSubmit)
            
            if authVM.deviceSupportsBiometrics {
                Divider().padding(.vertical, 2)
                
                Button {
                    if authVM.canUseBiometrics {
                        withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.22)) {
                            authVM.prefersPasswordForm = false
                        }
                        authVM.unlockWithBiometrics()
                    } else if !authVM.biometricsEnrolled {
                        authVM.errorMessage = authVM.biometricsStatusHint
                    } else {
                        authVM.errorMessage =
                            "Sign in with email once, then enable \(authVM.biometryName) when prompted."
                    }
                } label: {
                    HStack(spacing: AppSpacing.sm) {
                        Image(systemName: authVM.biometrySymbol)
                            .font(.title3)
                            .foregroundStyle(AppColors.primary)
                            .frame(width: 28)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(authVM.biometryName)
                                .font(AppTypography.rowTitle)
                                .foregroundStyle(.primary)
                            Text(authVM.biometricsStatusHint)
                                .font(AppTypography.meta)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(AppTypography.microBold)
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.vertical, 4)
                }
                .buttonStyle(.plain)
            }
            
            Button {
                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.2)) {
                    authVM.isSignUpMode.toggle()
                    authVM.errorMessage = nil
                }
            } label: {
                Text(
                    authVM.isSignUpMode
                        ? "Already have an account? Sign in"
                        : "First time? Create manager account"
                )
                .font(AppTypography.meta)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
                .padding(.top, 4)
            }
            .buttonStyle(.plain)
        }
        .padding(AppSpacing.lg)
        .appSurface(cornerRadius: 16)
    }
    
    private var canSubmit: Bool {
        !authVM.emailInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !authVM.passwordInput.isEmpty
    }
    
    private func errorBanner(_ message: String) -> some View {
        Text(message)
            .font(AppTypography.metaBold)
            .foregroundStyle(AppColors.rose)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
    
    private func optionalNonEmpty(_ value: String) -> String? {
        let t = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }
}
