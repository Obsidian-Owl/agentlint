#!/usr/bin/env python3
"""
Repository Analysis Script for Arc42 Documentation Generation

Analyzes a codebase to extract architectural information useful for
generating Arc42 documentation. Outputs a structured analysis report.

Usage:
    python analyze_repo.py <repo_path> [--output report.md]
"""

import os
import sys
import json
import argparse
from pathlib import Path
from collections import defaultdict
import re

# File patterns to identify project types and frameworks
PROJECT_MARKERS = {
    'javascript': ['package.json', 'yarn.lock', 'npm-shrinkwrap.json'],
    'typescript': ['tsconfig.json'],
    'python': ['setup.py', 'pyproject.toml', 'requirements.txt', 'Pipfile'],
    'java': ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    'go': ['go.mod', 'go.sum'],
    'rust': ['Cargo.toml'],
    'dotnet': ['*.csproj', '*.sln', '*.fsproj'],
    'ruby': ['Gemfile', 'Rakefile'],
    'php': ['composer.json'],
}

INFRASTRUCTURE_MARKERS = {
    'docker': ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml'],
    'kubernetes': ['*.yaml', '*.yml'],  # Will check for k8s content
    'terraform': ['*.tf', 'terraform.tfstate'],
    'cloudformation': ['template.yaml', 'template.json'],
    'ansible': ['playbook.yml', 'ansible.cfg'],
    'helm': ['Chart.yaml', 'values.yaml'],
}

DOC_PATTERNS = [
    'README*', 'ARCHITECTURE*', 'DESIGN*', 'ADR*',
    'docs/*', 'documentation/*', 'doc/*',
    'CONTRIBUTING*', 'CHANGELOG*',
]

API_PATTERNS = [
    'openapi*.json', 'openapi*.yaml', 'openapi*.yml',
    'swagger*.json', 'swagger*.yaml', 'swagger*.yml',
    '*.graphql', 'schema.graphql',
    '**/api/**', '**/rest/**', '**/graphql/**',
]


def find_files(repo_path, patterns):
    """Find files matching patterns in repo."""
    found = []
    repo = Path(repo_path)
    
    for pattern in patterns:
        if '**' in pattern:
            found.extend(repo.glob(pattern))
        elif '*' in pattern:
            found.extend(repo.glob(f'**/{pattern}'))
        else:
            # Exact match
            matches = list(repo.glob(f'**/{pattern}'))
            found.extend(matches)
    
    return [str(f.relative_to(repo)) for f in found if f.is_file()]


def detect_languages(repo_path):
    """Detect programming languages used in the project."""
    detected = {}
    
    for lang, markers in PROJECT_MARKERS.items():
        files = find_files(repo_path, markers)
        if files:
            detected[lang] = files
    
    return detected


def detect_infrastructure(repo_path):
    """Detect infrastructure and deployment tools."""
    detected = {}
    
    for tool, markers in INFRASTRUCTURE_MARKERS.items():
        files = find_files(repo_path, markers)
        if files:
            detected[tool] = files
    
    return detected


def find_documentation(repo_path):
    """Find existing documentation files."""
    return find_files(repo_path, DOC_PATTERNS)


def find_api_specs(repo_path):
    """Find API specification files."""
    return find_files(repo_path, API_PATTERNS)


def analyze_directory_structure(repo_path, max_depth=3):
    """Analyze directory structure to identify components."""
    repo = Path(repo_path)
    structure = defaultdict(list)
    
    # Common architectural directory patterns
    arch_dirs = [
        'src', 'lib', 'app', 'api', 'services', 'components',
        'modules', 'packages', 'core', 'domain', 'infrastructure',
        'handlers', 'controllers', 'models', 'views', 'routes',
        'utils', 'helpers', 'common', 'shared',
    ]
    
    for item in repo.iterdir():
        if item.is_dir() and not item.name.startswith('.'):
            if item.name.lower() in arch_dirs:
                structure['architectural_dirs'].append(item.name)
            
            # Check for subdirectories that might be components
            for subitem in item.iterdir():
                if subitem.is_dir() and not subitem.name.startswith('.'):
                    structure['potential_components'].append(
                        f"{item.name}/{subitem.name}"
                    )
    
    return dict(structure)


def extract_dependencies(repo_path):
    """Extract dependencies from package files."""
    deps = {}
    repo = Path(repo_path)
    
    # package.json (JavaScript/TypeScript)
    pkg_json = repo / 'package.json'
    if pkg_json.exists():
        try:
            with open(pkg_json) as f:
                data = json.load(f)
                deps['npm_dependencies'] = list(data.get('dependencies', {}).keys())
                deps['npm_dev_dependencies'] = list(data.get('devDependencies', {}).keys())
        except (json.JSONDecodeError, IOError):
            pass
    
    # requirements.txt (Python)
    req_txt = repo / 'requirements.txt'
    if req_txt.exists():
        try:
            with open(req_txt) as f:
                deps['python_dependencies'] = [
                    line.split('==')[0].split('>=')[0].strip()
                    for line in f.readlines()
                    if line.strip() and not line.startswith('#')
                ]
        except IOError:
            pass
    
    # pom.xml (Java) - basic extraction
    pom_xml = repo / 'pom.xml'
    if pom_xml.exists():
        try:
            with open(pom_xml) as f:
                content = f.read()
                # Simple regex for artifact IDs
                artifacts = re.findall(r'<artifactId>([^<]+)</artifactId>', content)
                deps['maven_dependencies'] = artifacts
        except IOError:
            pass
    
    return deps


def find_entry_points(repo_path):
    """Identify likely entry points of the application."""
    entry_patterns = [
        'main.py', 'app.py', 'server.py', 'index.py',
        'main.js', 'index.js', 'app.js', 'server.js',
        'main.ts', 'index.ts', 'app.ts', 'server.ts',
        'Main.java', 'Application.java', 'App.java',
        'main.go', 'cmd/*/main.go',
        'main.rs', 'lib.rs',
        'Program.cs', 'Startup.cs',
    ]
    
    return find_files(repo_path, entry_patterns)


def find_config_files(repo_path):
    """Find configuration files."""
    config_patterns = [
        '*.config.*', 'config.*', '*.conf',
        'settings.*', '.env*', '*.properties',
        'application.yml', 'application.yaml', 'application.json',
    ]
    
    return find_files(repo_path, config_patterns)


def analyze_repository(repo_path):
    """Main analysis function - returns structured analysis."""
    analysis = {
        'languages': detect_languages(repo_path),
        'infrastructure': detect_infrastructure(repo_path),
        'documentation': find_documentation(repo_path),
        'api_specs': find_api_specs(repo_path),
        'structure': analyze_directory_structure(repo_path),
        'dependencies': extract_dependencies(repo_path),
        'entry_points': find_entry_points(repo_path),
        'config_files': find_config_files(repo_path),
    }
    
    return analysis


def format_report(analysis, repo_path):
    """Format analysis as markdown report."""
    report = []
    report.append(f"# Repository Analysis: {Path(repo_path).name}\n")
    
    # Languages
    report.append("## Detected Languages & Frameworks\n")
    if analysis['languages']:
        for lang, files in analysis['languages'].items():
            report.append(f"- **{lang}**: {', '.join(files[:3])}")
    else:
        report.append("*No language markers detected*")
    report.append("")
    
    # Infrastructure
    report.append("## Infrastructure & Deployment\n")
    if analysis['infrastructure']:
        for tool, files in analysis['infrastructure'].items():
            report.append(f"- **{tool}**: {', '.join(files[:3])}")
    else:
        report.append("*No infrastructure configuration detected*")
    report.append("")
    
    # Documentation
    report.append("## Existing Documentation\n")
    if analysis['documentation']:
        for doc in analysis['documentation'][:10]:
            report.append(f"- {doc}")
    else:
        report.append("*No documentation files found*")
    report.append("")
    
    # API Specs
    report.append("## API Specifications\n")
    if analysis['api_specs']:
        for spec in analysis['api_specs'][:5]:
            report.append(f"- {spec}")
    else:
        report.append("*No API specifications found*")
    report.append("")
    
    # Structure
    report.append("## Directory Structure Analysis\n")
    if analysis['structure'].get('architectural_dirs'):
        report.append("**Architectural directories:**")
        for d in analysis['structure']['architectural_dirs']:
            report.append(f"- {d}")
    if analysis['structure'].get('potential_components'):
        report.append("\n**Potential components:**")
        for c in analysis['structure']['potential_components'][:15]:
            report.append(f"- {c}")
    report.append("")
    
    # Entry Points
    report.append("## Entry Points\n")
    if analysis['entry_points']:
        for ep in analysis['entry_points'][:5]:
            report.append(f"- {ep}")
    else:
        report.append("*No entry points identified*")
    report.append("")
    
    # Dependencies (summary)
    report.append("## Key Dependencies\n")
    for dep_type, deps in analysis['dependencies'].items():
        if deps:
            report.append(f"**{dep_type}** ({len(deps)} total): {', '.join(deps[:10])}")
    report.append("")
    
    # Config Files
    report.append("## Configuration Files\n")
    if analysis['config_files']:
        for cf in analysis['config_files'][:10]:
            report.append(f"- {cf}")
    else:
        report.append("*No configuration files found*")
    
    return '\n'.join(report)


def main():
    parser = argparse.ArgumentParser(
        description='Analyze repository for Arc42 documentation'
    )
    parser.add_argument('repo_path', help='Path to repository')
    parser.add_argument('--output', '-o', help='Output file (default: stdout)')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    
    args = parser.parse_args()
    
    if not os.path.isdir(args.repo_path):
        print(f"Error: {args.repo_path} is not a directory", file=sys.stderr)
        sys.exit(1)
    
    analysis = analyze_repository(args.repo_path)
    
    if args.json:
        output = json.dumps(analysis, indent=2)
    else:
        output = format_report(analysis, args.repo_path)
    
    if args.output:
        with open(args.output, 'w') as f:
            f.write(output)
        print(f"Analysis written to {args.output}")
    else:
        print(output)


if __name__ == '__main__':
    main()
