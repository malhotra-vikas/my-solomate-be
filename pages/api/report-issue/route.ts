export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
    const RECIPIENTS = process.env.ISSUE_REPORT_RECIPIENTS

    if (!process.env.RESEND_API_KEY || !RECIPIENTS) {
        return NextResponse.json({ error: "Server not properly configured" }, { status: 500 })
    }

    const { subject, message, userEmail } = await req.json()

    if (!subject || !message) {
        return NextResponse.json({ error: "Missing subject or message" }, { status: 400 })
    }

    const { data, error } = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: [RECIPIENTS], // replace with your team
        subject: `[Issue Reported] ${subject}`,
        replyTo: userEmail,
        text: `From: ${userEmail || 'anonymous'}\n\n${message}`,
    })

    if (error) {
        console.error("Resend send error:", error)
        return NextResponse.json({ error: 'Failed to send issue report' }, { status: 500 })
    }

    return NextResponse.json({ message: "Issue Reported Successfully" }, { status: 200 });


}
