//! Private WASM ABI. The TypeScript adapter owns every allocation and never exposes pointers.
//! encoders 3.1.0 pins the model revision in its build-time catalog.
const MAX_INPUT_BYTES: usize = 262_144;

#[unsafe(no_mangle)]
pub extern "C" fn dimensions() -> usize {
    encoders::DIMENSIONS
}

#[unsafe(no_mangle)]
pub extern "C" fn revision_pointer() -> *const u8 {
    encoders::model::MODEL_REVISION.as_ptr()
}

#[unsafe(no_mangle)]
pub extern "C" fn revision_length() -> usize {
    encoders::model::MODEL_REVISION.len()
}

#[unsafe(no_mangle)]
pub extern "C" fn element_bytes() -> usize {
    size_of::<encoders::model::Elem>()
}

#[unsafe(no_mangle)]
pub extern "C" fn allocate(len: usize) -> *mut u8 {
    if len == 0 || len > MAX_INPUT_BYTES {
        return std::ptr::null_mut();
    }
    Box::into_raw(vec![0_u8; len].into_boxed_slice()) as *mut u8
}

/// # Safety
/// `ptr` and `len` must identify a live allocation returned by `allocate`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn release(ptr: *mut u8, len: usize) {
    if !ptr.is_null() && len > 0 && len <= MAX_INPUT_BYTES {
        unsafe { drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr, len))) };
    }
}

/// # Safety
/// The input and output must be separate, live allocations of the supplied lengths.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn encode(
    ptr: *const u8,
    len: usize,
    output: *mut u8,
    output_len: usize,
) -> u32 {
    if ptr.is_null()
        || output.is_null()
        || len > MAX_INPUT_BYTES
        || output_len != encoders::DIMENSIONS * size_of::<f32>()
    {
        return 1;
    }
    let bytes = unsafe { std::slice::from_raw_parts(ptr, len) };
    let Ok(text) = std::str::from_utf8(bytes) else {
        return 2;
    };
    let vector = encoders::encode_single(text);
    // Byte copies avoid alignment assumptions about the exported allocation ABI.
    let target = unsafe { std::slice::from_raw_parts_mut(output, output_len) };
    for (value, slot) in vector.iter().zip(target.chunks_exact_mut(size_of::<f32>())) {
        slot.copy_from_slice(&value.to_le_bytes());
    }
    0
}
