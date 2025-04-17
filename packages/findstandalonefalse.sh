#!/bin/bash

# Find all TypeScript files (excluding spec files)
find . -name "*.ts" -not -name "*.spec.ts" | while read file; do
  # Use awk to process each file
  # This handles multi-line matching better than grep for this case
  awk '
    # Set a flag when we find @Component({
    /@Component\s*\(\{/ { in_component=1; component_text=""; }
    
    # While inside a component, collect the text
    in_component { component_text = component_text $0; }
    
    # When we find the closing bracket, check if it has standalone
    in_component && /\}\)/ {
      in_component=0;
      if (component_text !~ /standalone\s*:/) {
        print FILENAME;
        exit;
      }
    }
  ' "$file"
done | sort -u