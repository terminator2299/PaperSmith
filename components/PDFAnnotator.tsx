"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Rnd } from "react-rnd";
import supabase from "../lib/supabaseClient";
import * as pdfjs from "pdfjs-dist";

import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

const Document = dynamic(
  () => import("react-pdf").then((mod) => mod.Document),
  { ssr: false }
);
const Page = dynamic(() => import("react-pdf").then((mod) => mod.Page), {
  ssr: false,
});

type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "signature"
  | "date"
  | "checkbox";

interface AnnotationArea {
  id: string;
  name: string | null;
  description: string | null;
  required: boolean;
  template_id: string | null;
  signatory_id: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  type: FieldType;
  page_number: number;
}

interface Signatory {
  id: string;
  created_at: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  template_id: string | null;
}

const colorMap = {
  text: "border-blue-500 bg-blue-200 bg-opacity-50",
  textarea: "border-green-500 bg-green-200 bg-opacity-50",
  number: "border-purple-500 bg-purple-200 bg-opacity-50",
  signature: "border-yellow-500 bg-yellow-200 bg-opacity-50",
  date: "border-orange-500 bg-orange-200 bg-opacity-50",
  checkbox: "border-pink-500 bg-pink-200 bg-opacity-50",
};

const PDFAnnotator: React.FC<{ pdfUrl: string; templateId: string }> = ({
  pdfUrl,
  templateId,
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [areas, setAreas] = useState<AnnotationArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [signatories, setSignatories] = useState<Signatory[]>([]);
  const pdfWrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [viewport, setViewport] = useState<pdfjs.PageViewport | null>(null);

  const [debugInfo, setDebugInfo] = useState<string>("");
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [pdfViewport, setPdfViewport] = useState<pdfjs.PageViewport | null>(
    null
  );

  useEffect(() => {
    const setupPdf = async () => {
      try {
        const pdfjsWorkerSrc = await import("pdfjs-dist/webpack");
        pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
          new Blob([pdfjsWorkerSrc], { type: "application/javascript" })
        );
        setIsWorkerReady(true);
      } catch (error) {
        console.error("Error setting up PDF.js worker:", error);
      }
    };

    setupPdf();
  }, []);

  useEffect(() => {
    if (!isWorkerReady) return;

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjs.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        setPdfViewport(viewport);
        setPdfDimensions({ width: viewport.width, height: viewport.height });
      } catch (error) {
        console.error("Error loading PDF:", error);
      }
    };
    loadPdf();
  }, [pdfUrl, isWorkerReady]);

  useEffect(() => {
    const updateScale = () => {
      if (pdfWrapperRef.current && pdfViewport) {
        const newScale = pdfWrapperRef.current.clientWidth / pdfViewport.width;
        setScale(newScale);
      }
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [pdfViewport]);

  useEffect(() => {
    const loadSignatories = async () => {
      const { data, error } = await supabase
        .from("signatories")
        .select("*")
        .eq("template_id", templateId);

      if (error) {
        console.error("Error loading signatories:", error);
      } else if (data) {
        setSignatories(data);
      }
    };

    const loadAnnotations = async () => {
      const { data, error } = await supabase
        .from("annotations")
        .select("*")
        .eq("template_id", templateId);

      if (error) {
        console.error("Error loading annotations:", error);
      } else if (data) {
        const formattedAreas = data.map((annotation) => ({
          ...annotation,
          x: Number(annotation.x),
          y: Number(annotation.y),
          width: Number(annotation.width),
          height: Number(annotation.height),
        }));
        setAreas(formattedAreas);
      }
    };
    loadAnnotations();
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadSignatories(), loadAnnotations()]);
      setLoading(false);
    };

    loadData();
  }, [templateId]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  useEffect(() => {
    const updateDimensions = () => {
      if (pdfWrapperRef.current) {
        const newWidth = pdfWrapperRef.current.clientWidth;
        setContainerWidth(newWidth);
        setScale(newWidth / pdfDimensions.width);
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [pdfDimensions.width]);

  const addArea = async (field_type: FieldType) => {
    if (!pdfViewport) return;

    const newArea: AnnotationArea = {
      id: `temp-${Date.now().toString()}`,
      name: "",
      description: "",
      required: false,
      signatory_id: signatories[0]?.id,
      template_id: null,
      x: 50,
      y: pdfViewport.height - 100,
      width: 100,
      height: 50,
      type: field_type,
      page_number: pageNumber,
    };
    setAreas([...areas, newArea]);
    setSelectedAreaId(newArea.id);
  };

  const updateArea = (id: string, newProps: Partial<AnnotationArea>) => {
    setAreas(
      areas.map((area) => (area.id === id ? { ...area, ...newProps } : area))
    );
  };
  const saveAreas = async () => {
    const annotationsToSave = areas.map((area) => ({
      ...(area.id.startsWith("temp-") ? {} : { id: area.id }),
      name: area.name,
      description: area.description,
      required: area.required,
      template_id: templateId,
      signatory_id: area.signatory_id,
      x: Math.round(area.x),
      y: Math.round(area.y),
      width: Math.round(area.width),
      height: Math.round(area.height),
      type: area.type,
      page_number: area.page_number,
    }));

    const { data, error } = await supabase
      .from("annotations")
      .upsert(annotationsToSave)
      .select();

    if (error) {
      console.error("Error saving annotations:", error);
    } else {
      console.log("Annotations saved successfully:", data);
    }
  };
  const handleAreaClick = (id: string) => {
    setSelectedAreaId(id);
  };

  const handleBackgroundClick = () => {
    setSelectedAreaId(null);
  };

  const selectedArea = areas.find((area) => area.id === selectedAreaId);

  const handleFieldChange = (field: keyof AnnotationArea, value: any) => {
    if (selectedAreaId) {
      updateArea(selectedAreaId, { [field]: value });
    }
  };

  const goToPrevPage = () => {
    setPageNumber((prevPageNumber) => Math.max(prevPageNumber - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prevPageNumber) =>
      Math.min(prevPageNumber + 1, numPages || 1)
    );
  };

  const currentPageAreas = areas.filter(
    (area) => area.page_number === pageNumber
  );
  return (
    <div className="flex flex-col lg:flex-row">
      <div className="w-full lg:w-3/4 pr-0 lg:pr-4 mb-4 lg:mb-0">
        <div
          className="relative border border-gray-300 overflow-auto"
          ref={pdfWrapperRef}
          onClick={handleBackgroundClick}
          style={{ height: "calc(100vh - 200px)" }}
        >
          {loading ? (
            <div>Loading PDF...</div>
          ) : (
            <>
              <Document file={pdfUrl} onLoadSuccess={onDocumentLoadSuccess}>
                <Page
                  pageNumber={pageNumber}
                  width={pdfWrapperRef.current?.clientWidth}
                />
              </Document>
              {pdfViewport && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: pdfViewport.width * scale,
                    height: pdfViewport.height * scale,
                    zIndex: 10,
                    pointerEvents: "none",
                  }}
                >
                  {currentPageAreas.map((area) => (
                    <Rnd
                      key={area.id}
                      size={{
                        width: area.width * scale,
                        height: area.height * scale,
                      }}
                      position={{
                        x: area.x * scale,
                        y: (pdfViewport.height - area.y - area.height) * scale,
                      }}
                      onDragStop={(e, d) => {
                        const newX = d.x / scale;
                        const newY =
                          pdfViewport.height - d.y / scale - area.height;
                        updateArea(area.id, {
                          x: Math.max(
                            0,
                            Math.min(newX, pdfViewport.width - area.width)
                          ),
                          y: Math.max(
                            0,
                            Math.min(newY, pdfViewport.height - area.height)
                          ),
                        });
                      }}
                      onResizeStop={(e, direction, ref, delta, position) => {
                        const newWidth = parseInt(ref.style.width) / scale;
                        const newHeight = parseInt(ref.style.height) / scale;
                        const newX = position.x / scale;
                        const newY =
                          pdfViewport.height - position.y / scale - newHeight;
                        updateArea(area.id, {
                          width: Math.min(newWidth, pdfViewport.width - newX),
                          height: Math.min(
                            newHeight,
                            pdfViewport.height - newY
                          ),
                          x: Math.max(
                            0,
                            Math.min(newX, pdfViewport.width - newWidth)
                          ),
                          y: Math.max(
                            0,
                            Math.min(newY, pdfViewport.height - newHeight)
                          ),
                        });
                      }}
                      bounds="parent"
                      enableResizing={{
                        top: true,
                        right: true,
                        bottom: true,
                        left: true,
                        topRight: true,
                        bottomRight: true,
                        bottomLeft: true,
                        topLeft: true,
                      }}
                      dragHandleClassName="draggable"
                      style={{ pointerEvents: "all" }}
                    >
                      <div
                        className={`draggable border-2 ${colorMap[area.type]} ${
                          area.id === selectedAreaId ? "ring-2" : ""
                        }`}
                        style={{
                          width: "100%",
                          height: "100%",
                          boxSizing: "border-box",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAreaClick(area.id);
                        }}
                      >
                        {area.name ? area.name : area.type}
                      </div>
                    </Rnd>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between">
          <div className="mb-2 sm:mb-0">
            <button
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
              className="bg-gray-200 px-4 py-2 rounded mr-2 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={goToNextPage}
              disabled={pageNumber >= (numPages || 1)}
              className="bg-gray-200 px-4 py-2 rounded disabled:opacity-50"
            >
              Next
            </button>
            <span className="ml-4">
              Page {pageNumber} of {numPages}
            </span>
          </div>
          <button
            onClick={saveAreas}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Save & Proceed
          </button>
          <div className="text-sm text-gray-500 mt-2">{debugInfo}</div>
        </div>
      </div>
      <div className="w-full lg:w-1/4 pl-0 lg:pl-4 mt-4 lg:mt-0">
        <div className="border border-gray-300 p-4 mb-4">
          <h3 className="font-bold mb-2">Add Field</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              "Text",
              "Textarea",
              "Signature",
              "Date",
              "Number",
              "Checkbox",
            ].map((type) => (
              <button
                key={type}
                onClick={() => {
                  addArea(type.toLowerCase() as FieldType);
                }}
                className="bg-gray-200 px-2 py-1 rounded text-sm"
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        <div className="border border-gray-300 p-4">
          {selectedArea ? (
            <>
              <h3 className="font-bold mb-2">Field Details</h3>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Recipient
                </label>
                {signatories.length > 0 ? (
                  <select
                    className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={selectedArea?.signatory_id || ""}
                    onChange={(e) =>
                      handleFieldChange(
                        "signatory_id",
                        e.target.value ? e.target.value : null
                      )
                    }
                  >
                    {signatories.map((signatory) => (
                      <option key={signatory.id} value={signatory.id}>
                        {signatory.name ||
                          signatory.email ||
                          "Unnamed Signatory"}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p>No signatories found for this template.</p>
                )}
              </div>
              <div className="mb-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="form-checkbox h-4 w-4 text-indigo-600"
                    checked={selectedArea.required}
                    onChange={(e) =>
                      handleFieldChange("required", e.target.checked)
                    }
                  />
                  <span className="ml-2 text-sm text-gray-700">Required</span>
                </label>
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Field name
                </label>
                <input
                  type="text"
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={selectedArea.name || ""}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Field description
                </label>
                <textarea
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  rows={3}
                  value={selectedArea.description || ""}
                  onChange={(e) =>
                    handleFieldChange("description", e.target.value)
                  }
                ></textarea>
              </div>
            </>
          ) : (
            <p>Select a field to edit its details.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFAnnotator;
