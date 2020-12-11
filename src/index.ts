import express from "express"
import fs from "fs"
import {
    pdfDir,
    docDir,
    mkdir,
    downloadFile,
    convert2pdf
} from "./handlers"

const app = express()

mkdir(pdfDir)
mkdir(docDir)
app.use("/pdf", express.static(pdfDir))
app.get("/convert2pdf", (req, res) => {
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

app.listen(8000)