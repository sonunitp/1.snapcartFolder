// import { auth } from "@/auth";
// import uploadOnCloudinary from "@/lib/cloudinary";
// import connectDb from "@/lib/db";
// import Grocery from "@/models/grocery.model";
// import { NextRequest, NextResponse } from "next/server";

// export async function POST(req:NextRequest) {
//     try {
//         await connectDb()
//         const session=await auth()
//         if(session?.user?.role!=="admin"){
//             return NextResponse.json(
//                 {message:"you are not admin"},
//                 {status:400}
//             )
//         }
//     const formData=await req.formData()
//     const name=formData.get("name") as string
//     const category=formData.get("category") as string
//       const unit=formData.get("unit") as string
//     const price=formData.get("price") as string
//     const file=formData.get("image") as Blob | null
//     let imageUrl
//     if(file){
//      imageUrl=await uploadOnCloudinary(file)
//     }
//     const grocery=await Grocery.create({
//         name,price,category,unit,image:imageUrl
//     })
//      return NextResponse.json(
//                 grocery,
//                 {status:200}
//             )
//     } catch (error) {
//          return NextResponse.json(
//                 {message:`add grocery error ${error}`},
//                 {status:500}
//             )
//     }
// }
import { auth } from "@/auth"; 
import uploadOnCloudinary from "@/lib/cloudinary";
import connectDb from "@/lib/db";
import Grocery from "@/models/grocery.model";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    await connectDb();

    // --- Check admin ---
    const session = await auth();
    if (session?.user?.role !== "admin") {
      return NextResponse.json({ message: "You are not admin" }, { status: 403 });
    }

    // --- Get form data ---
    const formData = await req.formData();
    const name = formData.get("name") as string;
    const category = formData.get("category") as string;
    const unit = formData.get("unit") as string;
    const price = formData.get("price") as string;
    const file = formData.get("image") as Blob | null;

    // --- Validate required fields ---
    if (!name || !category || !unit || !price) {
      return NextResponse.json({ message: "All fields are required" }, { status: 400 });
    }

    const priceNumber = parseFloat(price);
    if (isNaN(priceNumber)) {
      return NextResponse.json({ message: "Invalid price" }, { status: 400 });
    }

    // --- Upload image if exists ---
    let imageUrl: string | undefined;
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      imageUrl = await uploadOnCloudinary(buffer);
    }

    // --- Save grocery ---
    const grocery = await Grocery.create({
      name,
      category,
      unit,
      price: priceNumber,
      image: imageUrl,
    });

    return NextResponse.json(
      { message: "Grocery added successfully", grocery },
      { status: 200 }
    );

  } catch (error) {
    return NextResponse.json(
      { message: `Add grocery error: ${error}` },
      { status: 500 }
    );
  }
}