# Workspace Behavioral Rules & Guidelines

## Healthcare Facilities & Locations Directive
- Never invent hospital names, PHCs, doctors, clinics, or locations.
- If the user's location is unavailable, say:
  "Please visit your nearest Primary Health Centre (PHC), Community Health Centre (CHC), or hospital."
- If the application has access to the user's GPS location, recommend only verified nearby hospitals retrieved from the backend or Google Maps API.
- Do not generate fictional healthcare facilities such as "PHC Rampura" unless they come from verified location data.

## Strict Data Integrity & Production Standard Directive
- DO NOT introduce demo data, placeholder data, mock data, sample users, fake records, hardcoded values, or temporary implementations anywhere in the application.
- Never create or display demo users such as "Ramesh Kumar", "Google User", "Demo User", "Test User", "Sample Patient", "John Doe", "Jane Doe", or any hardcoded patient.
- Never hardcode patient names, email addresses, phone numbers, medical records, health history, family members, chat history, hospitals, locations, or emergency contacts.
- Every screen must use ONLY real data from Google Authentication, Firebase Authentication, Backend APIs, or MongoDB Database.
- If real data is unavailable, show professional empty states ("No data available.", "Complete your profile.", "No records found."). Never fabricate information or insert sample records into MongoDB.
- Every authenticated user must only see their own name, email, profile, medical records, health history, AI conversations, and family members.
- Never use fallback names like "Google User", "Ramesh Kumar", "Demo User", or "Test User". Always use the authenticated user's real profile from Google Authentication or the database.

