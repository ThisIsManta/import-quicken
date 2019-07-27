import { fs } from 'mz'

export function createFileChangeQueue(onFileChange: ({ filePath: string, removed: boolean }) => Promise<void>) {
	const fileChangeList: Array<{ filePath: string, removed: boolean }> = []

	let lastTimeout: NodeJS.Timeout = null
	let processing = false

	function push(filePath: string, removed: boolean) {
		if (filePath.split(/\\|\//).includes('.git')) {
			return
		}

		if (fs.existsSync(filePath) === false || fs.lstatSync(filePath).isDirectory()) {
			return
		}

		const index = fileChangeList.findIndex(item => item.filePath === filePath)
		if (index >= 0) {
			fileChangeList.splice(index, 1)
			fileChangeList.push({ filePath, removed })
		} else {
			fileChangeList.push({ filePath, removed })
		}

		if (processing) {
			return
		}

		clearTimeout(lastTimeout)

		lastTimeout = setTimeout(process, 1000)
	}

	async function process() {
		if (processing) {
			return
		}

		processing = true

		while (fileChangeList.length > 0) {
			await onFileChange(fileChangeList[0])
			fileChangeList.shift()
		}

		processing = false
	}

	return {
		add: (filePath: string) => push(filePath, false),
		remove: (filePath: string) => push(filePath, true),
		process,
	}
}