# Makefile because I forget how to do things

.PHONY: clean

# Runs the app in development mode
run:
	npx expo start

# Run this to build the webapp in ./dist
webapp:
	npx expo export --platform web