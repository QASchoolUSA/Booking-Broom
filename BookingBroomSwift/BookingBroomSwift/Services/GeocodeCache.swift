import Foundation
import CoreLocation

/// In-memory, address-keyed forward geocoder. De-duplicates concurrent lookups
/// for the same address and remembers misses so a bad address is only tried once
/// per launch. Replaces the old hardcoded Sanford fallback pin.
public actor GeocodeCache {
    public static let shared = GeocodeCache()
    
    private struct Coordinate: Sendable {
        let latitude: Double
        let longitude: Double
    }
    
    private var resolved: [String: Coordinate?] = [:]
    private var inFlight: [String: Task<Coordinate?, Never>] = [:]
    
    private init() {}
    
    public func coordinate(for address: String) async -> CLLocationCoordinate2D? {
        let key = Self.normalize(address)
        guard !key.isEmpty else { return nil }
        
        if let cached = resolved[key] {
            return cached.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
        }
        if let task = inFlight[key] {
            return await task.value.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
        }
        
        let task = Task<Coordinate?, Never> {
            let geocoder = CLGeocoder()
            guard let placemarks = try? await geocoder.geocodeAddressString(address),
                  let location = placemarks.first?.location else {
                return nil
            }
            return Coordinate(
                latitude: location.coordinate.latitude,
                longitude: location.coordinate.longitude
            )
        }
        inFlight[key] = task
        let result = await task.value
        inFlight[key] = nil
        resolved[key] = result
        return result.map { CLLocationCoordinate2D(latitude: $0.latitude, longitude: $0.longitude) }
    }
    
    nonisolated private static func normalize(_ address: String) -> String {
        address
            .lowercased()
            .components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }
}
