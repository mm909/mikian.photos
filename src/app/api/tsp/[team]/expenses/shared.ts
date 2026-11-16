import { NextResponse } from "next/server";

/** The answers the TSP expense routes share (the lasd26 guard's, with "captain" for "owner"). */
export const notFound = () => NextResponse.json({ ok: false, error: "No such expense." }, { status: 404 });
export const notYours = () => NextResponse.json({ ok: false, error: "Only a captain or whoever added it can change this line." }, { status: 403 });
export const notYourReceipt = () => NextResponse.json({ ok: false, error: "Only a captain or whoever attached this receipt can remove it." }, { status: 403 });
export const notOnEstimate = () => NextResponse.json({ ok: false, error: "Receipts go on the real costs under this category." }, { status: 400 });
