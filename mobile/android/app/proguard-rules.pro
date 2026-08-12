# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# MSAL's JWT library (nimbus-jose-jwt) optionally supports Ed25519/X25519 via
# Google Tink and PEM/EC parsing via BouncyCastle. Neither is an actual
# dependency here — Entra ID's token flow uses RSA/EC, not these algorithms —
# so R8 can't find these classes and, in release/minified builds, errors out
# rather than assuming they're safe to skip. They're genuinely unused optional
# codepaths; confirmed via a release build failure referencing exactly these.
-dontwarn com.google.crypto.tink.**
-dontwarn org.bouncycastle.**
-dontwarn edu.umd.cs.findbugs.annotations.**

# MSAL builds its auth request (and parses tokens) using classes read by exact
# name/field at runtime (Gson-style serialization). Without this, R8 renamed
# or stripped fields MSAL depends on, breaking sign-in in release with a
# "Missing type parameter" error — confirmed via a real release-build test.
-keep class com.microsoft.identity.** { *; }
-keep interface com.microsoft.identity.** { *; }
-dontwarn com.microsoft.identity.**

-keep class com.nimbusds.** { *; }
-keep interface com.nimbusds.** { *; }
-dontwarn com.nimbusds.**

-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses

# Gson — used internally by MSAL's common library for broker/cache
# (de)serialization via TypeToken. The com.microsoft.identity.** keep rule
# above does NOT cover this separate dependency, so R8 was still free to
# strip the generic type info Gson's reflection needs, producing the same
# "Missing type parameter" error even with that rule in place. Rules below
# are MSAL's own official consumer-rules.pro Gson section.
-dontwarn sun.misc.**
-keep class * extends com.google.gson.TypeAdapter
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer
-keep class com.google.gson.reflect.TypeToken { *; }
-keep class * extends com.google.gson.reflect.TypeToken { *; }
-keepclassmembers class * {
  @com.google.gson.annotations.SerializedName <fields>;
}
