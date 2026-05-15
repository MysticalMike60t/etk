BUILD_SCRIPT_PATH=scripts/build.mjs

build:
	node $(BUILD_SCRIPT_PATH)

build-chrome:
	node $(BUILD_SCRIPT_PATH) chrome

build-firefox:
	node $(BUILD_SCRIPT_PATH) firefox

clean:
	rm -rf dist
