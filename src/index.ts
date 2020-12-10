import express from "express"
import path from "path"
import http from "http"
import https from "https"
import {URL} from "url"
import fs from "fs"
import {spawn} from "child_process"

const app = express()
const pdfDir = path.join(__dirname, "../pdf")

app.use("/pdf", express.static(pdfDir))
app.use("/convert2pdf", (req, res) => {
    const url = req.query.url

    if (!url) {
        res.status(400)
        res.end("error")

        return
    }

    downloadFile(url as string)
    .then(filename => convert2pdf(filename as string))
    .then(pdfFile => {
        fs.createReadStream(pdfFile as string).pipe(res)
    })
})

function downloadFile(url: string) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url)
        const {base} = path.parse(urlObj.pathname)
        const filename = path.join(__dirname, "../docs", base)
        const writeStream = fs.createWriteStream(filename);
        let req = null
        const reqOpts = {
            hostname: urlObj.hostname,
                method: "GET",
                port: urlObj.port,
                path: urlObj.pathname
        }
        const handleRes = (res: http.IncomingMessage) => {
            res.pipe(writeStream)
            res.on("end", () => {
                writeStream.close()
                resolve(filename)
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
        }
    })
}

function convert2pdf(filename: string) {
    return new Promise((resolve, reject) => {
        spawn("libreoffice", [
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            pdfDir,
            filename
        ])
        .on("close", code => {
            if (code === 0) {
                const {name} = path.parse(filename)

                resolve(path.join(pdfDir, `${name}.pdf`))
            } else {
                reject()
            }
        })
        .on("error", err => reject(err))
    })
}


app.listen(8000)