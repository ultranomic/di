#!/usr/bin/env node

import { createProject } from './commands/new.js'

interface ParsedArgs {
  command: string | undefined
  projectName: string | undefined
}

function parseArgs(args: string[]): ParsedArgs {
  // Skip node and script path
  const cliArgs = args.slice(2)
  
  return {
    command: cliArgs[0],
    projectName: cliArgs[1]
  }
}

async function main(): Promise<void> {
  const { command, projectName } = parseArgs(process.argv)
  
  if (command === undefined || command === '--help' || command === '-h') {
    printUsage()
    process.exit(command === undefined ? 1 : 0)
  }
  
  if (command === 'new') {
    if (projectName === undefined) {
      console.error('Error: Project name is required')
      console.error('Usage: voxel new <project-name>')
      process.exit(1)
    }
    
    try {
      await createProject(projectName)
      console.log(`\n✅ Project "${projectName}" created successfully!`)
      console.log(`\nNext steps:`)
      console.log(`  cd ${projectName}`)
      console.log(`  pnpm install`)
      console.log(`  pnpm dev`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Error: ${message}`)
      process.exit(1)
    }
  } else {
    console.error(`Error: Unknown command "${command}"`)
    printUsage()
    process.exit(1)
  }
}

function printUsage(): void {
  console.log(`
Voxel CLI - Project scaffolding tool

Usage:
  voxel new <project-name>    Create a new Voxel project
  voxel --help                Show this help message

Examples:
  voxel new my-app            Create a new project called "my-app"
`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Fatal error: ${message}`)
  process.exit(1)
})
