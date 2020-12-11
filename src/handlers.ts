import fs from "fs"
import http from "http"
import https from "https"
import {URL} from "url"
import {spawn} from "child_process"
import path from "path"

export const pdfDir = path.join(__dirname, "../pdfs")
export const docDir = path.join("__dirname", "../docs")

function getToday() {
    const c = (n: number) => (100 + n).toString().substring(1)
    const date = new Date()

    return `${date.getFullYear()}/${c(date.getMonth() + 1)}/${c(date.getDate())}`
}

export function mkdir(dir: string) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true})
    }
}

export function downloadFile(url: string) {
    return new Promise((resolve, reject) => {
        const {
            hostname,
            port,
            pathname,
            protocol
        } = new URL(url)
        const todayPath = getToday()
        const {
            base,
            name
        } = path.parse(pathname)
        const filename = path.join(docDir, base)
        const existingPdf = path.join(pdfDir, todayPath, `${name}.pdf`)
        const reqOpts = {
            hostname,
            method: "GET",
            port,
            path: pathname
        }

        if (fs.existsSync(existingPdf)) {
            resolve({
                filename: existingPdf,
                exists: true
            })

            return
        }

        const writeStream = fs.createWriteStream(filename)
        const handleRes = (res: http.IncomingMessage) => {
            res.pipe(writeStream)
            res.on("end", () => {
                writeStream.close()
                resolve({
                    filename,
                    exists: false
                })
            })
        }
        let req = null

        if (protocol.includes("http")) {
            req = http.request(reqOpts, handleRes)
        } else if (protocol.includes("https")) {
            req = https.request(reqOpts, handleRes)
        }

        if (req) {
            req.on("error", err => reject(err))
            req.end()
        } else {
            reject("error")
        }
    })
}

export function convert2pdf(filename: string) {
    return new Promise((resolve, reject) => {
        const dir = path.join(pdfDir, getToday())

        mkdir(dir)
        spawn(
            "libreoffice",
            [
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                dir,
                filename
            ],
            {
                stdio: "inherit"
            }
        )
            .on("close", code => {
                if (code === 0) {
                    const {name} = path.parse(filename)

                    resolve(path.join(dir, `${name}.pdf`))
                    fs.unlink(filename, _ => { })
                } else {
                    reject()
                }
            })
            .on("error", err => reject(err))
    })
}