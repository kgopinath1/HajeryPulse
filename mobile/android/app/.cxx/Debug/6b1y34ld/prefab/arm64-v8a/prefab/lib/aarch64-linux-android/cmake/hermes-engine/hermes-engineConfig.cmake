if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "C:/Users/keerthanag/.gradle/caches/8.14.3/transforms/a111e92214493b6c15d4d5f3fbb52b57/transformed/hermes-android-0.81.6-debug/prefab/modules/libhermes/libs/android.arm64-v8a/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/keerthanag/.gradle/caches/8.14.3/transforms/a111e92214493b6c15d4d5f3fbb52b57/transformed/hermes-android-0.81.6-debug/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

