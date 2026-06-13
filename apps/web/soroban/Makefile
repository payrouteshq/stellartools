# Build subscription-engine WASM for Soroban
# Run from soroban/ directory

WASM_TARGET ?= wasm32-unknown-unknown
CRATE = subscription-engine

.PHONY: build debug release clean

# Default: release build (smaller WASM, required for deploy to avoid 413)
build: release

# Debug build (larger WASM, for local testing only)
debug:
	cargo build --target $(WASM_TARGET) -p $(CRATE)

# Release build (optimized, use this for deployment)
release:
	cargo build --target $(WASM_TARGET) --release -p $(CRATE)

clean:
	cargo clean

# Path to the release WASM (after running `make release`)
# Output: target/wasm32-unknown-unknown/release/subscription_engine.wasm
release-wasm:
	@echo "$(PWD)/target/$(WASM_TARGET)/release/subscription_engine.wasm"
