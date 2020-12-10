import express from "express"
import path from "path"
import http from "http"
import https from "https"
import {URL} from "url"
import fs from "fs"
import {spawn} from "child_process"

const app = express()
const pdfDir = path.join(__dirname, "../pdf")
const docDir = path.join("__dirname", "../docs")

function mkdir(dir: string) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true})
    }
}

mkdir(pdfDir)
mkdir(docDir)

function downloadFile(url: string) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url)
        const todayPath = getToday()
        const {
            base,
            name
        } = path.parse(urlObj.pathname)
        const dir = path.join(docDir, todayPath)
        const filename = path.join(dir, base)
        const existingPdf = path.join(pdfDir, todayPath, `${name}.pdf`)
        let req = null
        const reqOpts = {
            hostname: urlObj.hostname,
            method: "GET",
            port: urlObj.port,
            path: urlObj.pathname
        }

        if (fs.existsSync(existingPdf)) {
            resolve({
                filename: existingPdf,
                exists: true
            })
            return
        }

        mkdir(dir)

        const writeStream = fs.createWriteStream(filename);
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

        if (urlObj.protocol.includes("http")) {
            req = http.request(reqOpts, handleRes)
        } else if (urlObj.protocol.includes("https")) {
            req = https.request(reqOpts, handleRes)
        }

        if (req) {
            req.on("error", err => reject(err))
            req.end()
        } else {
            reject()
        }
    })
}

function convert2pdf(filename: string) {
    const dir = path.join(pdfDir, getToday())

    mkdir(dir)

    return new Promise((resolve, reject) => {
        spawn(
            "libreoffice",
            [
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                dir,
                filename
            ]
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

app.use("/pdf", express.static(pdfDir))
app.use("/convert2pdf", (req, res) => {
    const url = req.query.url
    const response = (pdfFile: string) => {
        res.set("Content-Type", "application/pdf")
        fs.createReadStream(pdfFile).pipe(res)
    }

    if (!url) {
        res.status(400)
        res.end("error")

        return
    }

    downloadFile(url as string)
        .then((obj: any) => {
            if (!obj.exists) {
                return convert2pdf(obj.filename)
            }

            response(obj.filename)

            return false
        })
        .then(pdfFile => {
            if (pdfFile !== false) {
                response(pdfFile as string)
            }
        })
        .catch(() => res.end("error"))
})

function getToday() {
    const two = (num: number) => (100 + num).toString().substring(1)
    const date = new Date()

    return `${date.getFullYear()}/${two(date.getMonth() + 1)}/${two(date.getDate())}`
}

app.listen(8000)